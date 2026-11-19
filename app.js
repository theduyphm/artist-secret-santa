// ⚠️ PASTE YOUR SUPABASE CREDENTIALS HERE
const SUPABASE_URL = 'https://bssqbajejbynwbujrifp.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_2Dmwpa5sx8WgYqEzn05M0A_LUe0L-OH';

const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let appData = { users: [], wishlist: [], drawn: false };
let currentUserId = localStorage.getItem('secretSantaUserId');

const loginView = document.getElementById('login-view');
const dashboardView = document.getElementById('dashboard-view');
const userControls = document.getElementById('user-controls');

// Helper: Upload image file to Supabase Storage (used for wishlist ref sheets)
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

    // Explicitly hide the join section if names are drawn
    const joinSection = document.getElementById('join-section');
    if (joinSection) {
        if (appData.drawn) {
            joinSection.classList.add('hidden');
        } else {
            joinSection.classList.remove('hidden');
        }
    }

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

    // 0. Render My Artist Profile

    document.getElementById('profile-display-name').textContent = user.name;
    document.getElementById('profile-display-bio').textContent = user.bio || 'No bio added yet.';

    document.getElementById('edit-profile-name').value = user.name;
    document.getElementById('edit-profile-bio').value = user.bio || '';


    // 1. Render My Wishlist
    const myItems = appData.wishlist.filter(item => item.user_id === user.id);
    const myWishlist = document.getElementById('my-wishlist');

    myWishlist.innerHTML = myItems.map(item => renderWishlistCard(item, true)).join('');

    // Populate Profile Preview Mode
    document.getElementById('preview-name').textContent = user.name;
    document.getElementById('preview-bio').textContent = user.bio || 'No bio added yet.';

    const previewWishlist = document.getElementById('preview-wishlist');
    if (myItems.length === 0) {
        previewWishlist.innerHTML = '<p><em>No OCs added to your wishlist yet!</em></p>';
    } else {
        previewWishlist.innerHTML = myItems.map(item => `
            <div class="art-card">
                <a href="${item.image_url}" target="_blank"><img src="${item.image_url}" alt="OC Ref"></a>
                <div class="art-card-body"><p>${item.description}</p></div>
            </div>
        `).join('');
    }

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

            const targetInfo = document.getElementById('target-profile-info');
            if (targetInfo) {
                targetInfo.innerHTML = targetUser.bio ? `<p><em>"${targetUser.bio}"</em></p>` : '';
            }

            const targetItems = appData.wishlist.filter(item => item.user_id === targetUser.id);
            const targetWishlist = document.getElementById('target-wishlist');

            if (targetItems.length === 0) {
                targetWishlist.innerHTML = '<p><em>This artist has not added any OCs to their wishlist yet!</em></p>';
            } else {
                targetWishlist.innerHTML = targetItems.map(item => renderWishlistCard(item, false)).join('');
            }
        }
    }

    // 3. Render All Artists Directory Gallery
    const allGallery = document.getElementById('all-wishlists-gallery');

    if (appData.users.length === 0) {
        allGallery.innerHTML = '<p><em>No artists have joined yet!</em></p>';
    } else {
        allGallery.innerHTML = appData.users.map(artist => {
            const artistItems = appData.wishlist.filter(item => item.user_id === artist.id);
            const coverImg = artistItems.length > 0 ? artistItems[0].image_url : null;
            const shortBio = artist.bio
                ? (artist.bio.length > 60 ? artist.bio.substring(0, 60) + '...' : artist.bio)
                : 'No bio yet.';

            return `
                <div class="art-card artist-directory-card" onclick="openArtistModal('${artist.id}')" style="cursor: pointer;">
                    ${coverImg ? `<img src="${coverImg}" alt="${artist.name}'s OC">` : ''}
                    <div class="art-card-body">
                        <strong>${artist.name}</strong>
                        <p><small>${shortBio}</small></p>
                        <span class="badge"><small>${artistItems.length} OC${artistItems.length === 1 ? '' : 's'}</small></span>
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
    loadData();
}

// Toggle Profile Edit Mode
window.toggleProfileEdit = function (isEditing) {
    document.getElementById('profile-view-mode').classList.toggle('hidden', isEditing);
    document.getElementById('profile-edit-form').classList.toggle('hidden', !isEditing);
};


// Open Modal for ANY Artist (Used for both "Preview Profile" and clicking an artist card)
window.openArtistModal = function (userId) {
    const artist = appData.users.find(u => u.id === userId);
    if (!artist) return;

    const artistItems = appData.wishlist.filter(item => item.user_id === artist.id);

    document.getElementById('preview-name').textContent = artist.name;
    document.getElementById('preview-bio').textContent = artist.bio || 'No bio added yet.';

    const previewWishlist = document.getElementById('preview-wishlist');
    if (artistItems.length === 0) {
        previewWishlist.innerHTML = '<p><em>No OCs added to their wishlist yet!</em></p>';
    } else {
        previewWishlist.innerHTML = artistItems.map(item => renderWishlistCard(item, false)).join('');
    }

    document.getElementById('profile-preview-mode').classList.remove('hidden');
};

// Toggle Profile Preview Modal (Defaults to opening your own profile when passed true)
window.toggleProfilePreview = function (isPreviewing) {
    if (isPreviewing) {
        openArtistModal(currentUserId);
    } else {
        document.getElementById('profile-preview-mode').classList.add('hidden');
    }
};

// Save Profile Updates
document.getElementById('profile-edit-form').onsubmit = async (e) => {
    e.preventDefault();
    const nameInput = document.getElementById('edit-profile-name');
    const bioInput = document.getElementById('edit-profile-bio');

    if (!nameInput || !bioInput) {
        console.error('Missing form inputs in HTML');
        return;
    }

    const newName = nameInput.value.trim();
    const newBio = bioInput.value.trim();

    if (!newName) return;

    const { error } = await db
        .from('users')
        .update({ name: newName, bio: newBio })
        .eq('id', currentUserId);

    if (error) {
        alert('Error updating profile: ' + error.message);
        return;
    }

    toggleProfileEdit(false);
    await loadData();
};

// Helper: Render an OC Wishlist Card with Anonymous Q&A Comments
function renderWishlistCard(item, isOwner = false) {
    const comments = item.comments || [];
    const commentsHtml = comments.length > 0
        ? comments.map((c, index) => `
            <div class="oc-comment">
                <span>${escapeHtml(c)}</span>
                <button type="button" class="delete-comment-btn" title="Delete comment" onclick="deleteOcComment('${item.id}', ${index})">✕</button>
            </div>
        `).join('')
        : '<p class="no-comments"><small><em>No questions yet.</em></small></p>';


    return `
        <div class="art-card">
            <a href="${item.image_url}" target="_blank"><img src="${item.image_url}" alt="OC Ref"></a>
            <div class="art-card-body">
                <div id="view-mode-${item.id}">
                    <p>${escapeHtml(item.description)}</p>
                    ${isOwner ? `
                        <div class="card-actions">
                            <button type="button" class="secondary small-btn" onclick="toggleEditMode('${item.id}', true)">Edit</button>
                            <button type="button" class="danger-btn small-btn" onclick="deleteWishlistItem('${item.id}')">Delete</button>
                        </div>
                    ` : ''}
                </div>

                ${isOwner ? `
                    <form id="edit-mode-${item.id}" class="edit-wishlist-form hidden" onsubmit="saveWishlistEdit(event, '${item.id}')">
                        <label><small>Replace Image (optional):</small></label>
                        <input type="file" id="edit-img-${item.id}" accept="image/*">
                        <textarea id="edit-desc-${item.id}" required>${escapeHtml(item.description)}</textarea>
                        <div class="card-actions">
                            <button type="submit" class="small-btn">Save</button>
                            <button type="button" class="secondary small-btn" onclick="toggleEditMode('${item.id}', false)">Cancel</button>
                        </div>
                    </form>
                ` : ''}

                <hr>

                <!-- Anonymous Q&A Comments Section -->
                <div class="oc-comments-section">
                    <strong>💬 Questions & Answers</strong>
                    <div class="oc-comments-list">${commentsHtml}</div>
                    <form class="oc-comment-form" onsubmit="addOcComment(event, '${item.id}')">
                        <input type="text" placeholder="Ask a question or reply..." required>
                        <button type="submit" class="small-btn">Post</button>
                    </form>
                </div>
            </div>
        </div>
    `;
}

// Basic XSS protection for user-typed comments/descriptions
function escapeHtml(str) {
    if (!str) return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

// Save a new comment onto the wishlist item's comments array
window.addOcComment = async function (event, itemId) {
    event.preventDefault();
    const form = event.target;
    const input = form.querySelector('input');
    const btn = form.querySelector('button');
    const text = input.value.trim();
    if (!text) return;

    btn.disabled = true;

    try {
        // Fetch latest comments first so simultaneous comments don't overwrite each other
        const { data: latestItem, error: fetchError } = await db
            .from('wishlist_items')
            .select('comments, user_id')
            .eq('id', itemId)
            .single();

        if (fetchError) throw fetchError;

        const updatedComments = [...(latestItem.comments || []), text];

        const { error: updateError } = await db
            .from('wishlist_items')
            .update({ comments: updatedComments })
            .eq('id', itemId);

        if (updateError) throw updateError;

        await loadData();

        // If the artist modal is currently open, refresh its contents too
        const modal = document.getElementById('profile-preview-mode');
        if (modal && !modal.classList.contains('hidden')) {
            openArtistModal(latestItem.user_id);
        }
    } catch (err) {
        alert('Could not post comment: ' + err.message);
    } finally {
        btn.disabled = false;
    }
};
// Delete a comment at a given index from a wishlist item
window.deleteOcComment = async function (itemId, commentIndex) {
    if (!confirm('Delete this comment?')) return;

    try {
        const { data: latestItem, error: fetchError } = await db
            .from('wishlist_items')
            .select('comments, user_id')
            .eq('id', itemId)
            .single();

        if (fetchError) throw fetchError;

        const updatedComments = (latestItem.comments || []).filter((_, i) => i !== commentIndex);

        const { error: updateError } = await db
            .from('wishlist_items')
            .update({ comments: updatedComments })
            .eq('id', itemId);

        if (updateError) throw updateError;

        await loadData();

        // Refresh the artist modal if it's currently open
        const modal = document.getElementById('profile-preview-mode');
        if (modal && !modal.classList.contains('hidden')) {
            openArtistModal(latestItem.user_id);
        }
    } catch (err) {
        alert('Could not delete comment: ' + err.message);
    }
};



// Start
loadData();