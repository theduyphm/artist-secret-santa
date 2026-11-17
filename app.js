// ⚠️ PASTE YOUR SUPABASE CREDENTIALS HERE
const SUPABASE_URL = 'https://bssqbajejbynwbujrifp.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_2Dmwpa5sx8WgYqEzn05M0A_LUe0L-OH';

const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let appData = { users: [], wishlist: [], drawn: false };
let currentUserId = localStorage.getItem('secretSantaUserId');

const loginView = document.getElementById('login-view');
const dashboardView = document.getElementById('dashboard-view');
const userControls = document.getElementById('user-controls');

// Helper: Upload image file to Supabase Storage and return public URL
async function uploadImageToSupabase(file) {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}-${Math.round(Math.random() * 1E9)}.${fileExt}`;

    const { error } = await db.storage
        .from('art-uploads')
        .upload(fileName, file);

    if (error) throw error;

    const { data } = db.storage
        .from('art-uploads')
        .getPublicUrl(fileName);

    return data.publicUrl;
}

// Fetch all data from Supabase
async function loadData() {
    const [usersRes, wishlistRes, stateRes] = await Promise.all([
        db.from('users').select('*'),
        db.from('wishlist_items').select('*'),
        db.from('app_state').select('*').eq('id', 1).single()
    ]);

    appData.users = usersRes.data || [];
    appData.wishlist = wishlistRes.data || [];
    appData.drawn = stateRes.data ? stateRes.data.drawn : false;

    render();
}

function render() {
    const currentUser = appData.users.find(u => u.id === currentUserId);

    if (!currentUser) {
        loginView.classList.remove('hidden');
        dashboardView.classList.add('hidden');
        userControls.classList.add('hidden');
        renderUserList();
    } else {
        loginView.classList.add('hidden');
        dashboardView.classList.remove('hidden');
        userControls.classList.remove('hidden');
        document.getElementById('current-user-name').textContent = currentUser.name;
        renderDashboard(currentUser);
    }
}

function renderUserList() {
    const userList = document.getElementById('user-list');
    userList.innerHTML = '';
    appData.users.forEach(user => {
        const btn = document.createElement('button');
        btn.className = 'user-btn';
        btn.textContent = user.name;
        btn.onclick = () => {
            currentUserId = user.id;
            localStorage.setItem('secretSantaUserId', user.id);
            render();
        };
        userList.appendChild(btn);
    });
}

function renderDashboard(user) {
    // 1. Render My Wishlist
    const myItems = appData.wishlist.filter(item => item.user_id === user.id);
    const myWishlist = document.getElementById('my-wishlist');
    
    myWishlist.innerHTML = myItems.map(item => `
        <div class="art-card">
            <a href="${item.image_url}" target="_blank"><img src="${item.image_url}" alt="OC Ref"></a>
            <div class="art-card-body">
                <div id="view-mode-${item.id}">
                    <p>${item.description}</p>
                    <div class="card-actions">
                        <button type="button" class="secondary small-btn" onclick="toggleEditMode('${item.id}', true)">Edit</button>
                        <button type="button" class="danger-btn small-btn" onclick="deleteWishlistItem('${item.id}')">Delete</button>
                    </div>
                </div>

                <form id="edit-mode-${item.id}" class="edit-wishlist-form hidden" onsubmit="saveWishlistEdit(event, '${item.id}')">
                    <label><small>Replace Image (optional):</small></label>
                    <input type="file" id="edit-img-${item.id}" accept="image/*">
                    <textarea id="edit-desc-${item.id}" required>${item.description}</textarea>
                    <div class="card-actions">
                        <button type="submit" class="small-btn">Save</button>
                        <button type="button" class="secondary small-btn" onclick="toggleEditMode('${item.id}', false)">Cancel</button>
                    </div>
                </form>
            </div>
        </div>
    `).join('');

    // 2. Render Secret Santa Status
    document.getElementById('participant-count').textContent = appData.users.length;
    const preDraw = document.getElementById('pre-draw-area');
    const postDraw = document.getElementById('post-draw-area');

    if (!appData.drawn) {
        preDraw.classList.remove('hidden');
        postDraw.classList.add('hidden');
    } else {
        preDraw.classList.add('hidden');
        postDraw.classList.remove('hidden');

        const targetUser = appData.users.find(u => u.id === user.assigned_to);
        if (targetUser) {
            document.getElementById('target-name').textContent = targetUser.name;
            const targetItems = appData.wishlist.filter(item => item.user_id === targetUser.id);
            const targetWishlist = document.getElementById('target-wishlist');
            
            if (targetItems.length === 0) {
                targetWishlist.innerHTML = '<p><em>This artist has not added any OCs to their wishlist yet!</em></p>';
            } else {
                targetWishlist.innerHTML = targetItems.map(item => `
                    <div class="art-card">
                        <a href="${item.image_url}" target="_blank"><img src="${item.image_url}" alt="Target OC"></a>
                        <div class="art-card-body"><p>${item.description}</p></div>
                    </div>
                `).join('');
            }
        }

        // Show or hide uploaded gift preview
        const uploadedGiftDiv = document.getElementById('my-uploaded-gift');
        const giftPreviewImg = document.getElementById('my-gift-preview');
        
        if (user.gift_image) {
            uploadedGiftDiv.classList.remove('hidden');
            giftPreviewImg.src = user.gift_image;
        } else {
            uploadedGiftDiv.classList.add('hidden');
            giftPreviewImg.src = '';
        }
    }

    // 3. Render Completed Gifts Gallery
    const gallery = document.getElementById('all-gifts-gallery');
    const completedGifts = appData.users.filter(u => u.gift_image);
    
    if (completedGifts.length === 0) {
        gallery.innerHTML = '<p>No gifts uploaded yet!</p>';
    } else {
        gallery.innerHTML = completedGifts.map(giver => {
            const receiver = appData.users.find(u => u.id === giver.assigned_to);
            return `
                <div class="art-card">
                    <a href="${giver.gift_image}" target="_blank"><img src="${giver.gift_image}" alt="Gift Art"></a>
                    <div class="art-card-body">
                        <strong>To: ${receiver ? receiver.name : 'Unknown'}</strong><br>
                        <small>From: ${giver.name}</small>
                        <p>${giver.gift_message || ''}</p>
                    </div>
                </div>
            `;
        }).join('');
    }
}

// Join / Create User
document.getElementById('new-user-form').onsubmit = async (e) => {
    e.preventDefault();
    const nameInput = document.getElementById('new-username');
    const name = nameInput.value.trim();
    if (!name) return;

    const existing = appData.users.find(u => u.name.toLowerCase() === name.toLowerCase());
    if (existing) {
        currentUserId = existing.id;
        localStorage.setItem('secretSantaUserId', existing.id);
        nameInput.value = '';
        render();
        return;
    }

    const { data, error } = await db
        .from('users')
        .insert([{ name }])
        .select()
        .single();

    if (error) return alert('Error joining: ' + error.message);

    currentUserId = data.id;
    localStorage.setItem('secretSantaUserId', data.id);
    nameInput.value = '';
    loadData();
};

document.getElementById('logout-btn').onclick = () => {
    currentUserId = null;
    localStorage.removeItem('secretSantaUserId');
    render();
};

// Add Wishlist Item
document.getElementById('wishlist-form').onsubmit = async (e) => {
    e.preventDefault();
    const btn = document.getElementById('wishlist-submit-btn');
    btn.disabled = true;
    btn.textContent = 'Uploading...';

    try {
        const file = document.getElementById('oc-image').files[0];
        const description = document.getElementById('oc-desc').value;
        const imageUrl = await uploadImageToSupabase(file);

        await db.from('wishlist_items').insert([{
            user_id: currentUserId,
            description,
            image_url: imageUrl
        }]);

        e.target.reset();
        await loadData();
    } catch (err) {
        alert('Upload failed: ' + err.message);
    } finally {
        btn.disabled = false;
        btn.textContent = 'Add to My Wishlist';
    }
};

// Edit & Delete Wishlist Helpers
function toggleEditMode(itemId, isEditing) {
    document.getElementById(`view-mode-${itemId}`).classList.toggle('hidden', isEditing);
    document.getElementById(`edit-mode-${itemId}`).classList.toggle('hidden', !isEditing);
}

async function saveWishlistEdit(event, itemId) {
    event.preventDefault();
    const fileInput = document.getElementById(`edit-img-${itemId}`);
    const description = document.getElementById(`edit-desc-${itemId}`).value;
    
    const updates = { description };

    try {
        if (fileInput.files[0]) {
            updates.image_url = await uploadImageToSupabase(fileInput.files[0]);
        }
        await db.from('wishlist_items').update(updates).eq('id', itemId);
        await loadData();
    } catch (err) {
        alert('Failed to save edit: ' + err.message);
    }
}

async function deleteWishlistItem(itemId) {
    if (!confirm('Remove this OC from your wishlist?')) return;
    await db.from('wishlist_items').delete().eq('id', itemId);
    await loadData();
}

// Draw Secret Santa Names
document.getElementById('draw-names-btn').onclick = async () => {
    if (appData.users.length < 2) {
        return alert('Need at least 2 artists to draw!');
    }
    if (!confirm('Are all artists signed up? This will assign everyone a Secret Santa!')) return;

    const givers = [...appData.users];
    let receivers = [...appData.users];
    let valid = false;

    while (!valid) {
        for (let i = receivers.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [receivers[i], receivers[j]] = [receivers[j], receivers[i]];
        }
        valid = givers.every((giver, idx) => giver.id !== receivers[idx].id);
    }

    // Update all assignments in Supabase
    for (let i = 0; i < givers.length; i++) {
        await db.from('users')
            .update({ assigned_to: receivers[i].id })
            .eq('id', givers[i].id);
    }

    await db.from('app_state').update({ drawn: true }).eq('id', 1);
    await loadData();
};

// Upload Finished Gift
document.getElementById('gift-upload-form').onsubmit = async (e) => {
    e.preventDefault();
    const btn = document.getElementById('gift-submit-btn');
    btn.disabled = true;
    btn.textContent = 'Uploading Gift...';

    try {
        const file = document.getElementById('gift-file').files[0];
        const message = document.getElementById('gift-message').value;
        const giftImageUrl = await uploadImageToSupabase(file);

        await db.from('users')
            .update({ gift_image: giftImageUrl, gift_message: message })
            .eq('id', currentUserId);

        alert('Gift uploaded! 🎁');
        e.target.reset();
        await loadData();
    } catch (err) {
        alert('Gift upload failed: ' + err.message);
    } finally {
        btn.disabled = false;
        btn.textContent = 'Upload Gift';
    }
};

document.getElementById('toggle-gifts-btn').onclick = () => {
    document.getElementById('all-gifts-gallery').classList.toggle('hidden');
};

// Start
loadData();