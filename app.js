// -------------------------------------------------------------
// HEMANTH'S STUDY NOTES - APPLICATION LOGIC
// -------------------------------------------------------------

window.onerror = function (message, source, lineno, colno, error) {
    alert("Diagnostics (app.js) - JavaScript Error:\n" + message + "\nSource: " + source + "\nLine: " + lineno + "\nCol: " + colno + (error ? "\nStack: " + error.stack : ""));
    return false;
};

// Supabase Configuration
const SUPABASE_URL = "https://dvhlfwnzkdhaanptjobs.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR2aGxmd256a2RoYWFucHRqb2JzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM4NjE1MzYsImV4cCI6MjA5OTQzNzUzNn0.JwX5Zq8ZFpm_7SZHVyzVYXWsFYdVbEslaX25Xgs-VLo";

// Initialize Supabase Client Safely by reusing/overwriting the global variable
var supabase;
try {
    if (window.supabase && typeof window.supabase.createClient === 'function') {
        supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    } else {
        console.error("Supabase script was not loaded. Database functionality will be unavailable.");
        supabase = null;
    }
} catch (e) {
    console.error("Supabase client initialization failed:", e);
    supabase = null;
}

// Safe Session Storage Helpers (Fallback for file:// protocol)
function getSavedSession() {
    try {
        const session = sessionStorage.getItem('notes_user_session');
        return session ? JSON.parse(session) : null;
    } catch (e) {
        console.warn("sessionStorage read blocked, using memory session:", e);
        return window.inMemorySession || null;
    }
}

function saveSession(session) {
    try {
        sessionStorage.setItem('notes_user_session', JSON.stringify(session));
    } catch (e) {
        console.warn("sessionStorage write blocked, using memory session:", e);
        window.inMemorySession = session;
    }
}

function removeSession() {
    try {
        sessionStorage.removeItem('notes_user_session');
    } catch (e) {
        console.warn("sessionStorage remove blocked:", e);
        window.inMemorySession = null;
    }
}

// Generic activity logs writer helper
async function logActivity(actorName, actionType, details) {
    if (!supabase) return;
    try {
        await supabase
            .from('activity_logs')
            .insert([{
                actor_name: actorName,
                action_type: actionType,
                details: details
            }]);
    } catch (e) {
        console.error("Failed to write to activity_logs table:", e);
    }
}

// Application State
let currentSession = null; // { role: 'user'|'admin', username: string }
let allNotes = [];
let activeTab = 'all-notes';
let selectedCategory = 'all';
let currentUploadedImageBlob = null;
let currentUploadedImageName = "";
let currentUploadedImageSize = 0;

// Storage Limit Constant (100MB in bytes)
const STORAGE_LIMIT_BYTES = 100 * 1024 * 1024; // 104,857,600 bytes

// DOM Elements
const gateScreen = document.getElementById('gate-screen');
const appContainer = document.getElementById('app-container');
const gateForm = document.getElementById('gate-form');
const gatePasswordInput = document.getElementById('gate-password');
const gateError = document.getElementById('gate-error');

const nicknameStep = document.getElementById('nickname-step');
const nicknameForm = document.getElementById('nickname-form');
const nicknameInput = document.getElementById('nickname-input');
const nicknamePasswordInput = document.getElementById('nickname-password');
const nicknameError = document.getElementById('nickname-error');
const gateInputWrapper = document.getElementById('gate-input-wrapper');

// Auth Tabs selectors
const authTabLogin = document.getElementById('auth-tab-login');
const authTabSignup = document.getElementById('auth-tab-signup');
const authMode = document.getElementById('auth-mode');
const authHint = document.getElementById('auth-hint');
const authSubmitBtn = document.getElementById('auth-submit-btn');

// Tab Panels & Nav Buttons
const navItems = document.querySelectorAll('.nav-item');
const sections = document.querySelectorAll('.content-section');
const pageTitle = document.getElementById('main-page-title');
const pageSubtitle = document.getElementById('main-page-subtitle');

// Profile Info
const headerUsername = document.getElementById('header-username');
const sidebarAvatar = document.getElementById('sidebar-avatar');
const sidebarNickname = document.getElementById('sidebar-nickname');
const sidebarRole = document.getElementById('sidebar-role');
const storagePanel = document.getElementById('storage-panel');
const storageText = document.getElementById('storage-text');
const storageBar = document.getElementById('storage-bar');
const logoutBtn = document.getElementById('logout-btn');
const editUsernameBtn = document.getElementById('edit-username-btn');

// Notes views
const cardGrid = document.getElementById('card-grid');
const searchInput = document.getElementById('note-search');
const filterChips = document.getElementById('filter-chips');

// Create Note Form
const noteForm = document.getElementById('note-form');
const uploadZone = document.getElementById('upload-zone');
const fileInput = document.getElementById('file-input');
const uploadPreview = document.getElementById('upload-preview');
const uploadPreviewImg = document.getElementById('upload-preview-img');
const uploadPreviewRemove = document.getElementById('upload-preview-remove');

// Log views
const logsTableBody = document.getElementById('logs-table-body');
const clearLogsBtn = document.getElementById('clear-logs-btn');

// Admin Panel views
const totalNotesStat = document.getElementById('stat-total-notes');
const totalUsersStat = document.getElementById('stat-total-users');
const totalStorageStat = document.getElementById('stat-total-storage');
const totalDownloadsStat = document.getElementById('stat-total-downloads');
const adminUsersList = document.getElementById('admin-users-list');
const adminBlockedList = document.getElementById('admin-blocked-list');
const blockUserForm = document.getElementById('block-user-form');
const blockUserInput = document.getElementById('block-user-input');

// Modal Elements
const noteModal = document.getElementById('note-modal');
const modalClose = document.getElementById('modal-close');
const modalTitle = document.getElementById('modal-title');
const modalAuthor = document.getElementById('modal-author');
const modalDate = document.getElementById('modal-date');
const modalImage = document.getElementById('modal-image');
const modalContent = document.getElementById('modal-content');
const modalDownloadBtn = document.getElementById('modal-download-btn');

// Initialize Application
window.addEventListener('DOMContentLoaded', () => {
    checkSession();
    lucide.createIcons();
});

// Check existing session
function checkSession() {
    const savedSession = getSavedSession();
    if (savedSession) {
        currentSession = savedSession;
        setupDashboard();
    } else {
        showGate();
    }
}

// Show Gate Screen
function showGate() {
    gateScreen.style.display = 'flex';
    appContainer.style.display = 'none';
    appContainer.classList.remove('active');
    nicknameStep.style.display = 'none';
    gateInputWrapper.style.display = 'block';
    gatePasswordInput.value = '';
}

// Setup Dashboard View
async function setupDashboard() {
    gateScreen.style.display = 'none';
    appContainer.style.display = 'flex';
    setTimeout(() => {
        appContainer.classList.add('active');
    }, 50);

    // Set User Profile metadata
    headerUsername.textContent = currentSession.username;
    sidebarNickname.textContent = currentSession.username;
    sidebarAvatar.textContent = currentSession.username.substring(0, 2).toUpperCase();
    sidebarRole.textContent = currentSession.role === 'admin' ? 'Administrator' : 'Student';

    // Show/Hide admin features
    const adminNav = document.querySelector('[data-section="admin-panel"]');
    const logsNav = document.querySelector('[data-section="audit-logs"]');
    
    if (currentSession.role === 'admin') {
        if (adminNav) adminNav.style.display = 'block';
        if (storagePanel) storagePanel.style.display = 'none'; // Admin has unlimited, no need for bar
        if (editUsernameBtn) editUsernameBtn.style.display = 'none';
    } else {
        if (adminNav) adminNav.style.display = 'none';
        if (storagePanel) storagePanel.style.display = 'block';
        if (editUsernameBtn) editUsernameBtn.style.display = 'flex';
        updateStorageProgress();
    }

    // Load notes
    await loadNotes();
    
    // Auto navigation to active tab
    switchTab('all-notes');
}

// Gate Form Submission
gateForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    gateError.style.display = 'none';
    
    const password = gatePasswordInput.value.trim();
    
    if (password === "HH@@##123456789") {
        // Admin Login
        currentSession = { role: 'admin', username: 'Admin' };
        saveSession(currentSession);
        setupDashboard();
    } else if (password === "modren") {
        // Normal User Login Phase 1: Show nickname prompt
        gateInputWrapper.style.display = 'none';
        nicknameStep.style.display = 'block';
        nicknameInput.focus();
    } else {
        gateError.style.display = 'flex';
        gateError.innerHTML = `<i data-lucide="alert-circle"></i> Incorrect password. Please try again.`;
        lucide.createIcons();
    }
});

// Auth Tabs Toggle logic
if (authTabLogin && authTabSignup) {
    authTabLogin.addEventListener('click', () => {
        if (authMode) authMode.value = 'login';
        authTabLogin.classList.add('active');
        authTabSignup.classList.remove('active');
        authTabLogin.style.background = 'rgba(255, 255, 255, 0.08)';
        authTabLogin.style.color = 'var(--text-primary)';
        authTabSignup.style.background = 'transparent';
        authTabSignup.style.color = 'var(--text-secondary)';
        if (authHint) authHint.textContent = 'Enter the password you used when creating this account.';
        if (authSubmitBtn) authSubmitBtn.innerHTML = 'Enter Dashboard <i data-lucide="chevron-right"></i>';
        lucide.createIcons();
    });

    authTabSignup.addEventListener('click', () => {
        if (authMode) authMode.value = 'signup';
        authTabSignup.classList.add('active');
        authTabLogin.classList.remove('active');
        authTabSignup.style.background = 'rgba(255, 255, 255, 0.08)';
        authTabSignup.style.color = 'var(--text-primary)';
        authTabLogin.style.background = 'transparent';
        authTabLogin.style.color = 'var(--text-secondary)';
        if (authHint) authHint.textContent = 'Choose a password to protect your notes from others.';
        if (authSubmitBtn) authSubmitBtn.innerHTML = 'Create Account <i data-lucide="user-plus"></i>';
        lucide.createIcons();
    });
}

// Nickname Form Submission
nicknameForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    nicknameError.style.display = 'none';
    
    const name = nicknameInput.value.trim();
    const password = nicknamePasswordInput.value.trim();
    const mode = authMode ? authMode.value : 'login';
    if (!name || !password) return;
    
    if (name.toLowerCase() === 'admin') {
        nicknameError.style.display = 'flex';
        nicknameError.innerHTML = `<i data-lucide="alert-circle"></i> "Admin" is a reserved name.`;
        lucide.createIcons();
        return;
    }

    // Check if Supabase client is loaded
    if (!supabase) {
        nicknameError.style.display = 'flex';
        nicknameError.innerHTML = `<i data-lucide="alert-circle"></i> Database offline. Entering offline guest mode...`;
        lucide.createIcons();
        
        // Fallback: Login without database check
        setTimeout(() => {
            currentSession = { role: 'user', username: name };
            saveSession(currentSession);
            setupDashboard();
        }, 1500);
        return;
    }

    try {
        // 1. Check if name is blocked in Supabase database
        const { data: blockedData, error: blockErr } = await supabase
            .from('blocked_users')
            .select('*')
            .eq('name', name)
            .maybeSingle();

        if (blockErr) throw blockErr;
        
        if (blockedData) {
            nicknameError.style.display = 'flex';
            nicknameError.innerHTML = `<i data-lucide="alert-circle"></i> This account is blocked by the administrator.`;
            lucide.createIcons();
            return;
        }

        // 2. Query student_accounts table to see if user exists
        const { data: accountData, error: accountErr } = await supabase
            .from('student_accounts')
            .select('*')
            .eq('name', name)
            .maybeSingle();

        if (accountErr) throw accountErr;

        if (mode === 'login') {
            if (!accountData) {
                nicknameError.style.display = 'flex';
                nicknameError.innerHTML = `<i data-lucide="alert-circle"></i> Account name does not exist. Switch to "New Student" to sign up.`;
                lucide.createIcons();
                return;
            }
            // Verify password
            if (accountData.password !== password) {
                nicknameError.style.display = 'flex';
                nicknameError.innerHTML = `<i data-lucide="alert-circle"></i> Incorrect password for this account name.`;
                lucide.createIcons();
                return;
            }
        } else {
            // Mode is signup
            if (accountData) {
                nicknameError.style.display = 'flex';
                nicknameError.innerHTML = `<i data-lucide="alert-circle"></i> Name already taken. Choose a different nickname or switch to Log In.`;
                lucide.createIcons();
                return;
            }
            // Register account!
            const { error: registerErr } = await supabase
                .from('student_accounts')
                .insert([{ name, password }]);

            if (registerErr) throw registerErr;
            
            // Log signup activity
            await logActivity(name, 'signup', 'Registered a new student account.');
        }

        // Proceed with login
        currentSession = { role: 'user', username: name };
        saveSession(currentSession);
        setupDashboard();
    } catch (err) {
        console.error('Auth verification error:', err);
        // Fallback: Allow login if database query fails (offline compatibility)
        nicknameError.style.display = 'flex';
        nicknameError.innerHTML = `<i data-lucide="alert-circle"></i> Database error. Entering temporary offline mode...`;
        lucide.createIcons();
        
        setTimeout(() => {
            currentSession = { role: 'user', username: name };
            saveSession(currentSession);
            setupDashboard();
        }, 1500);
    }
});

// Logout Action
logoutBtn.addEventListener('click', () => {
    removeSession();
    currentSession = null;
    showGate();
});

// Edit Username Action
if (editUsernameBtn) {
    editUsernameBtn.addEventListener('click', async () => {
        if (!currentSession || currentSession.role === 'admin') {
            alert("Cannot edit Administrator name.");
            return;
        }

        const oldName = currentSession.username;
        const newName = prompt("Enter your new nickname / account name:", oldName);
        if (!newName) return;
        
        const cleanedName = newName.trim();
        if (!cleanedName || cleanedName === oldName) return;

        if (cleanedName.toLowerCase() === 'admin') {
            alert('"Admin" is a reserved name.');
            return;
        }

        const editBtn = document.getElementById('edit-username-btn');
        const originalHtml = editBtn.innerHTML;
        editBtn.disabled = true;
        editBtn.innerHTML = `<i data-lucide="loader" class="animate-spin" style="width: 14.5px; height: 14.5px;"></i>`;
        lucide.createIcons();

        try {
            if (supabase) {
                // Check block status of the new name
                const { data: isBlocked, error: blockErr } = await supabase
                    .from('blocked_users')
                    .select('id')
                    .eq('name', cleanedName)
                    .maybeSingle();

                if (blockErr) throw blockErr;
                if (isBlocked) {
                    alert("This account name is blocked by the administrator.");
                    return;
                }

                // Update database entries associated with old name
                // 1. Update account credentials
                const { error: errAccount } = await supabase
                    .from('student_accounts')
                    .update({ name: cleanedName })
                    .eq('name', oldName);

                if (errAccount) throw errAccount;

                // 2. Update notes publisher name
                const { error: errNotes } = await supabase
                    .from('notes')
                    .update({ author_name: cleanedName })
                    .eq('author_name', oldName);

                if (errNotes) throw errNotes;

                // 3. Update author name in download logs
                await supabase
                    .from('download_logs')
                    .update({ author_name: cleanedName })
                    .eq('author_name', oldName);

                // 4. Update downloader name in download logs
                await supabase
                    .from('download_logs')
                    .update({ downloader_name: cleanedName })
                    .eq('downloader_name', oldName);
            }

            // Update local session
            currentSession.username = cleanedName;
            saveSession(currentSession);

            // Log name change activity
            await logActivity(cleanedName, 'rename', `Changed profile account name from "${oldName}" to "${cleanedName}".`);

            // Update UI
            headerUsername.textContent = cleanedName;
            sidebarNickname.textContent = cleanedName;
            sidebarAvatar.textContent = cleanedName.substring(0, 2).toUpperCase();

            // Refresh dashboards
            await loadNotes();
            renderNotes();
            updateStorageProgress();

            alert(`Your account name has been updated to "${cleanedName}"!`);
        } catch (err) {
            console.error('Failed to update username:', err);
            alert('Database error: Failed to sync new name.');
        } finally {
            editBtn.disabled = false;
            editBtn.innerHTML = originalHtml;
            lucide.createIcons();
        }
    });
}

// Navigation / Tabs System
navItems.forEach(item => {
    item.addEventListener('click', () => {
        const targetSection = item.getAttribute('data-section');
        switchTab(targetSection);
    });
});

function switchTab(sectionId) {
    activeTab = sectionId;
    
    // Update active nav button
    navItems.forEach(item => {
        if (item.getAttribute('data-section') === sectionId) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });

    // Update active section panel
    sections.forEach(section => {
        if (section.id === sectionId) {
            section.classList.add('active');
        } else {
            section.classList.remove('active');
        }
    });

    // Update page headers
    if (sectionId === 'all-notes') {
        pageTitle.textContent = "Browse Notes";
        pageSubtitle.textContent = "Search and download study notes from the community.";
        renderNotes();
    } else if (sectionId === 'my-notes') {
        pageTitle.textContent = "My Published Notes";
        pageSubtitle.textContent = "Manage notes you have posted on this platform.";
        renderNotes();
    } else if (sectionId === 'add-note') {
        pageTitle.textContent = "Publish New Note";
        pageSubtitle.textContent = "Write notes and attach reference diagrams or images.";
        resetForm();
    } else if (sectionId === 'audit-logs') {
        pageTitle.textContent = "Download Records Audit";
        pageSubtitle.textContent = "Live log of note downloads recorded on this portal.";
        loadLogs();
    } else if (sectionId === 'admin-panel') {
        pageTitle.textContent = "Administrator Workspace";
        pageSubtitle.textContent = "Manage notes, users, blocklists, and check system stats.";
        loadAdminData();
    }
}

// -------------------------------------------------------------
// STORAGE TRACKING AND LIMIT CHECKS
// -------------------------------------------------------------

// Calculate aggregate storage size used by a user (notes text + images)
async function getStorageUsed(username) {
    try {
        const { data, error } = await supabase
            .from('notes')
            .select('image_size, content_size')
            .eq('author_name', username);

        if (error) throw error;
        
        let total = 0;
        data.forEach(item => {
            total += (item.image_size || 0) + (item.content_size || 0);
        });
        return total;
    } catch (err) {
        console.error('Storage calculation failed:', err);
        return 0;
    }
}

// Update UI storage progress bar in sidebar
async function updateStorageProgress() {
    if (currentSession.role === 'admin') return;

    const usedBytes = await getStorageUsed(currentSession.username);
    const percentage = Math.min((usedBytes / STORAGE_LIMIT_BYTES) * 100, 100);
    
    const usedMB = (usedBytes / (1024 * 1024)).toFixed(2);
    storageText.textContent = `${usedMB} MB / 100 MB`;
    storageBar.style.width = `${percentage}%`;

    // Dynamic warning colors
    storageBar.className = 'storage-bar';
    if (percentage > 90) {
        storageBar.classList.add('danger');
    } else if (percentage > 70) {
        storageBar.classList.add('warning');
    }
}

// Check if user is blocked before doing mutations
async function checkIsBlocked(username) {
    try {
        const { data, error } = await supabase
            .from('blocked_users')
            .select('id')
            .eq('name', username)
            .maybeSingle();

        if (error) throw error;
        return !!data;
    } catch (e) {
        return false;
    }
}

// -------------------------------------------------------------
// DATA LOADERS
// -------------------------------------------------------------

// Load notes from DB
async function loadNotes() {
    try {
        const { data, error } = await supabase
            .from('notes')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;
        allNotes = data || [];
    } catch (err) {
        console.error('Failed to load notes:', err);
    }
}

// Load logs
async function loadLogs() {
    try {
        const { data, error } = await supabase
            .from('activity_logs')
            .select('*')
            .order('timestamp', { ascending: false });

        if (error) throw error;
        renderLogs(data || []);
    } catch (err) {
        console.error('Failed to load activity logs:', err);
    }
}

// Render logs table
function renderLogs(logs) {
    logsTableBody.innerHTML = '';
    
    if (logs.length === 0) {
        logsTableBody.innerHTML = `
            <tr>
                <td colspan="4" style="text-align: center; color: var(--text-muted); padding: 40px;">
                    No activities recorded yet.
                </td>
            </tr>
        `;
        return;
    }

    logs.forEach(log => {
        const date = new Date(log.timestamp).toLocaleString();
        
        // Dynamic badges based on activity types
        let badgeClass = 'badge-primary';
        if (log.action_type === 'signup') badgeClass = 'badge-success';
        if (log.action_type === 'publish') badgeClass = 'badge-primary';
        if (log.action_type === 'delete') badgeClass = 'badge-danger';
        if (log.action_type === 'download') badgeClass = 'badge-success';
        if (log.action_type === 'block') badgeClass = 'badge-danger';
        if (log.action_type === 'unblock') badgeClass = 'badge-primary';
        
        const actionLabel = log.action_type.toUpperCase();

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><span class="badge badge-primary">${escapeHTML(log.actor_name)}</span></td>
            <td><span class="badge ${badgeClass}">${actionLabel}</span></td>
            <td style="color: var(--text-primary); font-weight: 500;">${escapeHTML(log.details)}</td>
            <td style="color: var(--text-secondary);">${date}</td>
        `;
        logsTableBody.appendChild(tr);
    });
}

// -------------------------------------------------------------
// IMAGE PROCESSING & UPLOADS
// -------------------------------------------------------------

// Handle File upload events
uploadZone.addEventListener('click', () => fileInput.click());

uploadZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadZone.classList.add('dragover');
});

uploadZone.addEventListener('dragleave', () => {
    uploadZone.classList.remove('dragover');
});

uploadZone.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadZone.classList.remove('dragover');
    if (e.dataTransfer.files.length) {
        processImageFile(e.dataTransfer.files[0]);
    }
});

fileInput.addEventListener('change', (e) => {
    if (e.target.files.length) {
        processImageFile(e.target.files[0]);
    }
});

// Remove Image Preview
uploadPreviewRemove.addEventListener('click', (e) => {
    e.stopPropagation();
    currentUploadedImageBlob = null;
    currentUploadedImageName = "";
    currentUploadedImageSize = 0;
    uploadPreview.style.display = 'none';
    uploadZone.style.display = 'block';
    fileInput.value = '';
});

// Process Image file: Resize and Compress client-side via Canvas
function processImageFile(file) {
    if (!file.type.startsWith('image/')) {
        alert('Only image files are allowed.');
        return;
    }

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = function (event) {
        const img = new Image();
        img.src = event.target.result;
        img.onload = function () {
            // Setup Canvas compression sizes
            const canvas = document.createElement('canvas');
            let width = img.width;
            let height = img.height;
            
            // Constrain width or height to maximum 1200px
            const maxDimension = 1200;
            if (width > maxDimension || height > maxDimension) {
                if (width > height) {
                    height = Math.round((height * maxDimension) / width);
                    width = maxDimension;
                } else {
                    width = Math.round((width * maxDimension) / height);
                    height = maxDimension;
                }
            }

            canvas.width = width;
            canvas.height = height;
            
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);

            // Compress to JPEG with 70% quality
            canvas.toBlob((blob) => {
                currentUploadedImageBlob = blob;
                currentUploadedImageName = `${Date.now()}_${cleanFileName(file.name)}`;
                currentUploadedImageSize = blob.size;
                
                // Set Preview UI
                uploadPreviewImg.src = URL.createObjectURL(blob);
                uploadZone.style.display = 'none';
                uploadPreview.style.display = 'block';
            }, 'image/jpeg', 0.7);
        };
    };
}

function cleanFileName(name) {
    return name.replace(/[^a-zA-Z0-9.]/g, '_');
}

// -------------------------------------------------------------
// SUBMIT NOTE
// -------------------------------------------------------------
noteForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    // Check block status
    const isBlocked = await checkIsBlocked(currentSession.username);
    if (isBlocked) {
        alert("You cannot publish. This account is blocked by the administrator.");
        return;
    }

    const title = document.getElementById('note-title').value.trim();
    const content = document.getElementById('note-content').value.trim();
    const category = document.getElementById('note-category').value;
    
    if (!title) {
        alert('Please provide a note title.');
        return;
    }
    
    if (!content && !currentUploadedImageBlob) {
        alert('Please provide either note content text or attach an image.');
        return;
    }

    const submitBtn = noteForm.querySelector('button[type="submit"]');
    const originalBtnText = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = `<i data-lucide="loader" class="animate-spin"></i> Publishing...`;
    lucide.createIcons();

    try {
        // Calculate sizes
        const contentSize = new Blob([title, content, category]).size;
        const newImageSize = currentUploadedImageBlob ? currentUploadedImageSize : 0;
        const noteTotalSize = contentSize + newImageSize;

        // Limit validation for normal users
        if (currentSession.role !== 'admin') {
            const currentUsed = await getStorageUsed(currentSession.username);
            if (currentUsed + noteTotalSize > STORAGE_LIMIT_BYTES) {
                throw new Error(`Upload exceeds 100MB limit. You have used ${(currentUsed / (1024 * 1024)).toFixed(2)} MB.`);
            }
        }

        let imageUrl = null;
        let imageFileName = null;

        // 1. Upload compressed image if present to Supabase storage
        if (currentUploadedImageBlob) {
            const filePath = `notes/${currentSession.username}/${currentUploadedImageName}`;
            const { data, error: uploadError } = await supabase.storage
                .from('notes_images')
                .upload(filePath, currentUploadedImageBlob, {
                    cacheControl: '3600',
                    upsert: true
                });

            if (uploadError) throw uploadError;

            // Get Public URL
            imageFileName = filePath;
            imageUrl = `${SUPABASE_URL}/storage/v1/object/public/notes_images/${filePath}`;
        }

        // 2. Insert record into Notes table
        const { error: dbError } = await supabase
            .from('notes')
            .insert([{
                title,
                content,
                author_name: currentSession.username,
                image_url: imageUrl,
                image_name: imageFileName,
                image_size: newImageSize,
                content_size: contentSize
            }]);

        if (dbError) throw dbError;

        // Log upload activity
        const uploadDetails = currentUploadedImageBlob 
            ? `Published note "${title}" with attached image (${(newImageSize/(1024*1024)).toFixed(2)} MB).`
            : `Published text note "${title}".`;
        await logActivity(currentSession.username, 'publish', uploadDetails);

        alert('Note published successfully!');
        resetForm();
        await loadNotes();
        switchTab('all-notes');
        
    } catch (err) {
        alert(err.message || 'An error occurred during publication.');
        console.error(err);
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalBtnText;
        lucide.createIcons();
    }
});

function resetForm() {
    noteForm.reset();
    currentUploadedImageBlob = null;
    currentUploadedImageName = "";
    currentUploadedImageSize = 0;
    uploadPreview.style.display = 'none';
    uploadZone.style.display = 'block';
    fileInput.value = '';
    updateStorageProgress();
}

// -------------------------------------------------------------
// RENDER NOTES GRID AND CARD FILTERS
// -------------------------------------------------------------
searchInput.addEventListener('input', renderNotes);

function createFilterChips() {
    // Collect all tags/categories or hardcode SaaS styles
    const categories = ['all', 'Mathematics', 'Science', 'Computer Science', 'History', 'Other'];
    filterChips.innerHTML = '';
    
    categories.forEach(cat => {
        const btn = document.createElement('button');
        btn.className = `filter-chip ${selectedCategory === cat ? 'active' : ''}`;
        btn.textContent = cat === 'all' ? 'All Subjects' : cat;
        btn.addEventListener('click', () => {
            selectedCategory = cat;
            createFilterChips();
            renderNotes();
        });
        filterChips.appendChild(btn);
    });
}

function renderNotes() {
    createFilterChips();
    
    // Choose active grid container dynamically based on active tab
    const activeGrid = (activeTab === 'my-notes') ? document.getElementById('my-card-grid') : cardGrid;
    if (!activeGrid) return;
    activeGrid.innerHTML = '';
    
    const query = searchInput.value.toLowerCase().trim();
    
    // Filter logic
    let filtered = allNotes;
    
    // 1. My notes filter
    if (activeTab === 'my-notes') {
        filtered = filtered.filter(n => n.author_name === currentSession.username);
    }
    
    // 2. Category filter
    if (selectedCategory !== 'all') {
        filtered = filtered.filter(n => {
            return n.title.toLowerCase().includes(selectedCategory.toLowerCase()) || 
                   n.content.toLowerCase().includes(selectedCategory.toLowerCase());
        });
    }

    // 3. Search query filter
    if (query) {
        filtered = filtered.filter(n => 
            n.title.toLowerCase().includes(query) || 
            n.content.toLowerCase().includes(query) || 
            n.author_name.toLowerCase().includes(query)
        );
    }

    if (filtered.length === 0) {
        activeGrid.innerHTML = `
            <div class="empty-state" style="grid-column: 1 / -1;">
                <div class="empty-state-icon">
                    <i data-lucide="book-x"></i>
                </div>
                <h3>No notes found</h3>
                <p>Try matching title, author, or search a different subject.</p>
            </div>
        `;
        lucide.createIcons();
        return;
    }

    filtered.forEach(note => {
        const dateStr = new Date(note.created_at).toLocaleDateString();
        const hasImage = !!note.image_url;
        
        const card = document.createElement('div');
        card.className = 'note-card';
        
        let imgHtml = '';
        if (hasImage) {
            imgHtml = `
                <div class="note-card-img-wrapper">
                    <img src="${note.image_url}" class="note-card-img" alt="${escapeHTML(note.title)}" loading="lazy">
                </div>
            `;
        }
        
        // Show delete option if user is author or admin
        const canDelete = note.author_name === currentSession.username || currentSession.role === 'admin';
        const deleteButton = canDelete ? `
            <button class="btn btn-secondary btn-delete" style="color: var(--danger); border-color: rgba(239,68,68,0.2);" data-id="${note.id}" data-imgname="${note.image_name || ''}">
                <i data-lucide="trash-2"></i> Delete
            </button>
        ` : '';

        card.innerHTML = `
            ${imgHtml}
            <div class="note-card-body">
                <div class="note-card-header">
                    <h3 class="note-card-title">${escapeHTML(note.title)}</h3>
                </div>
                <div class="note-card-meta">
                    <span>By <span class="meta-author">${escapeHTML(note.author_name)}</span></span>
                    <span>•</span>
                    <span>${dateStr}</span>
                </div>
                <div class="note-card-snippet">${escapeHTML(note.content)}</div>
                <div class="note-card-footer">
                    <div class="card-actions">
                        <button class="btn btn-primary btn-view" data-id="${note.id}">
                            <i data-lucide="maximize-2"></i> Open
                        </button>
                        <button class="btn btn-secondary btn-download" data-id="${note.id}">
                            <i data-lucide="download"></i> Download
                        </button>
                        ${deleteButton}
                    </div>
                </div>
            </div>
        `;
        
        // Card Listeners
        card.querySelector('.btn-view').addEventListener('click', () => openNoteModal(note));
        card.querySelector('.btn-download').addEventListener('click', () => downloadNote(note));
        if (canDelete) {
            card.querySelector('.btn-delete').addEventListener('click', (e) => {
                const noteId = e.currentTarget.getAttribute('data-id');
                const imgName = e.currentTarget.getAttribute('data-imgname');
                deleteNote(noteId, imgName, note.title);
            });
        }
        
        activeGrid.appendChild(card);
    });
    
    lucide.createIcons();
}

// Delete Note Action
async function deleteNote(noteId, imgName, noteTitle) {
    if (!confirm('Are you sure you want to delete this study note? This action is irreversible.')) {
        return;
    }

    try {
        const isBlocked = await checkIsBlocked(currentSession.username);
        if (isBlocked && currentSession.role !== 'admin') {
            alert('Cannot perform action. Your account is blocked.');
            return;
        }

        // 1. Delete image file from storage if exists
        if (imgName) {
            const { error: storageError } = await supabase.storage
                .from('notes_images')
                .remove([imgName]);
            
            if (storageError) {
                console.warn('Failed to delete image file, proceeding with database delete:', storageError);
            }
        }

        // 2. Delete note from notes table
        const { error: dbError } = await supabase
            .from('notes')
            .delete()
            .eq('id', noteId);

        if (dbError) throw dbError;

        // Log delete activity
        await logActivity(currentSession.username, 'delete', `Deleted note "${noteTitle || 'Untitled note'}".`);

        alert('Note deleted successfully.');
        await loadNotes();
        renderNotes();
        updateStorageProgress();
    } catch (err) {
        console.error(err);
        alert('Failed to delete note.');
    }
}

// -------------------------------------------------------------
// DOWNLOAD SYSTEM & AUDIT LOGGING
// -------------------------------------------------------------
async function downloadNote(note) {
    if (!supabase) {
        alert("Database offline. Actions not available.");
        return;
    }
    
    try {
        let downloadTriggered = false;

        // 1. Download image if present
        if (note.image_url) {
            try {
                const response = await fetch(note.image_url);
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                const ext = note.image_name ? note.image_name.split('.').pop() : 'jpg';
                a.download = `${note.title.toLowerCase().replace(/[^a-z0-9]/g, '_')}.${ext}`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                window.URL.revokeObjectURL(url);
                downloadTriggered = true;
            } catch (err) {
                console.error("Image file download failed, opening in new tab:", err);
                window.open(note.image_url, '_blank');
                downloadTriggered = true;
            }
        }

        // 2. Download text note if content is present
        if (note.content && note.content.trim().length > 0) {
            const fileContent = `================================================
HEMANTH'S STUDY NOTES - DOWNLOADED NOTE
================================================
Title: ${note.title}
Author: ${note.author_name}
Published: ${new Date(note.created_at).toLocaleString()}
------------------------------------------------

${note.content}

------------------------------------------------
Attachment: ${note.image_url || 'None'}
================================================`;

            const blob = new Blob([fileContent], { type: 'text/plain;charset=utf-8' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `${note.title.toLowerCase().replace(/[^a-z0-9]/g, '_')}_notes.txt`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            downloadTriggered = true;
        }

        if (!downloadTriggered) {
            alert("This note has no text content or attached image to download.");
            return;
        }

        // Record the download event in the database
        await logActivity(currentSession.username, 'download', `Downloaded note "${note.title}".`);

        // Refresh logs in UI
        if (activeTab === 'audit-logs') {
            await loadLogs();
        }
    } catch (err) {
        console.error('Failed to log download:', err);
    }
}

// -------------------------------------------------------------
// NOTE VIEWER MODAL
// -------------------------------------------------------------
function openNoteModal(note) {
    modalTitle.textContent = note.title;
    modalAuthor.textContent = note.author_name;
    modalDate.textContent = new Date(note.created_at).toLocaleDateString();
    
    if (note.image_url) {
        modalImage.src = note.image_url;
        modalImage.style.display = 'block';
    } else {
        modalImage.style.display = 'none';
    }
    
    modalContent.textContent = note.content;
    
    // Bind download click
    modalDownloadBtn.onclick = () => {
        downloadNote(note);
    };

    noteModal.classList.add('active');
}

modalClose.addEventListener('click', () => {
    noteModal.classList.remove('active');
});

noteModal.addEventListener('click', (e) => {
    if (e.target === noteModal) {
        noteModal.classList.remove('active');
    }
});

// -------------------------------------------------------------
// AUDIT LOGS MANAGEMENT (ADMIN)
// -------------------------------------------------------------
if (clearLogsBtn) {
    clearLogsBtn.addEventListener('click', async () => {
        if (!confirm('Are you sure you want to purge all activity logs?')) return;
        
        try {
            const { error } = await supabase
                .from('activity_logs')
                .delete()
                .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

            if (error) throw error;
            alert('Activity logs cleared.');
            loadLogs();
        } catch (err) {
            console.error(err);
            alert('Failed to clear logs.');
        }
    });
}

// -------------------------------------------------------------
// ADMIN CONTROL PANEL ACTIONS
// -------------------------------------------------------------

async function loadAdminData() {
    if (currentSession.role !== 'admin') return;

    try {
        // 1. Fetch system statistics
        // Total notes count
        const { count: notesCount, error: err1 } = await supabase
            .from('notes')
            .select('*', { count: 'exact', head: true });
            
        // Total download events
        const { count: downloadsCount, error: err2 } = await supabase
            .from('activity_logs')
            .select('*', { count: 'exact', head: true })
            .eq('action_type', 'download');

        // Storage size and unique authors calculation
        const { data: allNotesData, error: err3 } = await supabase
            .from('notes')
            .select('author_name, image_size, content_size');

        if (err1 || err2 || err3) throw new Error("Stats load error");

        // Sum storage & collect active accounts
        let totalStorageBytes = 0;
        const usersStorageMap = {}; // { username: total_bytes }
        
        allNotesData.forEach(note => {
            const bytes = (note.image_size || 0) + (note.content_size || 0);
            totalStorageBytes += bytes;
            
            if (note.author_name !== 'Admin') {
                usersStorageMap[note.author_name] = (usersStorageMap[note.author_name] || 0) + bytes;
            }
        });

        const activeUsersCount = Object.keys(usersStorageMap).length;
        
        // Render stats UI
        totalNotesStat.textContent = notesCount || 0;
        totalUsersStat.textContent = activeUsersCount;
        totalStorageStat.textContent = `${(totalStorageBytes / (1024 * 1024)).toFixed(2)} MB`;
        totalDownloadsStat.textContent = downloadsCount || 0;

        // 2. Render Users list with storage stats
        adminUsersList.innerHTML = '';
        if (Object.keys(usersStorageMap).length === 0) {
            adminUsersList.innerHTML = `<div style="color: var(--text-muted); font-size:13px;">No student storage activity yet.</div>`;
        } else {
            Object.entries(usersStorageMap).forEach(([username, bytes]) => {
                const mbUsed = (bytes / (1024 * 1024)).toFixed(2);
                const percent = Math.min((bytes / STORAGE_LIMIT_BYTES) * 100, 100);
                
                const userItem = document.createElement('div');
                userItem.className = 'user-list-item';
                userItem.innerHTML = `
                    <div class="user-list-info" style="flex-grow:1; margin-right:16px;">
                        <div class="user-list-name">${escapeHTML(username)}</div>
                        <div style="display:flex; align-items:center; gap:10px; margin-top:4px;">
                            <div class="storage-track" style="flex-grow:1; max-width: 150px; margin-bottom:0;">
                                <div class="storage-bar" style="width: ${percent}%;"></div>
                            </div>
                            <span class="user-list-meta">${mbUsed} MB / 100 MB (${percent.toFixed(0)}%)</span>
                        </div>
                    </div>
                    <button class="btn btn-secondary btn-block-user" style="padding: 6px 12px; font-size: 12px; color: var(--danger); border-color: rgba(239,68,68,0.2);" data-name="${username}">
                        Block
                    </button>
                `;
                
                userItem.querySelector('.btn-block-user').addEventListener('click', () => blockUser(username));
                adminUsersList.appendChild(userItem);
            });
        }

        // 3. Render Blocked list
        const { data: blockedData, error: errBlock } = await supabase
            .from('blocked_users')
            .select('*')
            .order('blocked_at', { ascending: false });

        if (errBlock) throw errBlock;

        adminBlockedList.innerHTML = '';
        if (!blockedData || blockedData.length === 0) {
            adminBlockedList.innerHTML = `<div style="color: var(--text-muted); font-size:13px;">No blocked accounts.</div>`;
        } else {
            blockedData.forEach(blockedUser => {
                const date = new Date(blockedUser.blocked_at).toLocaleDateString();
                const blockedItem = document.createElement('div');
                blockedItem.className = 'user-list-item';
                blockedItem.innerHTML = `
                    <div class="user-list-info">
                        <div class="user-list-name" style="text-decoration: line-through; color: var(--text-muted);">${escapeHTML(blockedUser.name)}</div>
                        <div class="user-list-meta">Blocked on ${date}</div>
                    </div>
                    <button class="btn btn-secondary btn-unblock-user" style="padding: 6px 12px; font-size: 12px; color: var(--success); border-color: rgba(16,185,129,0.2);" data-name="${blockedUser.name}">
                        Unblock
                    </button>
                `;
                
                blockedItem.querySelector('.btn-unblock-user').addEventListener('click', () => unblockUser(blockedUser.name));
                adminBlockedList.appendChild(blockedItem);
            });
        }

    } catch (err) {
        console.error('Failed to load admin workspace stats:', err);
    }
}

// Block user function
async function blockUser(username) {
    if (!username) return;
    if (!confirm(`Are you sure you want to block student "${username}"? They will lose access to upload or delete posts.`)) return;

    try {
        const { error } = await supabase
            .from('blocked_users')
            .insert([{ name: username }]);

        if (error) throw error;
        
        // Log block activity
        await logActivity(currentSession.username, 'block', `Blocked student account "${username}".`);

        alert(`Account "${username}" blocked successfully.`);
        loadAdminData();
    } catch (err) {
        console.error(err);
        alert('Failed to block account.');
    }
}

// Unblock user function
async function unblockUser(username) {
    if (!username) return;
    try {
        const { error } = await supabase
            .from('blocked_users')
            .delete()
            .eq('name', username);

        if (error) throw error;
        
        // Log unblock activity
        await logActivity(currentSession.username, 'unblock', `Unblocked student account "${username}".`);

        alert(`Account "${username}" unblocked.`);
        loadAdminData();
    } catch (err) {
        console.error(err);
        alert('Failed to unblock account.');
    }
}

// Block user via custom input submit
if (blockUserForm) {
    blockUserForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = blockUserInput.value.trim();
        if (!username) return;
        
        await blockUser(username);
        blockUserInput.value = '';
    });
}

// -------------------------------------------------------------
// UTILS
// -------------------------------------------------------------
function escapeHTML(str) {
    if (!str) return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}
