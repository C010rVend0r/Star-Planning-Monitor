// auth.js - Authentication & Authorization Module
// ============================================================
// SUPABASE AUTH INTEGRATION
// ============================================================

// ============================================================
// USER ROLES
// ============================================================
const ROLES = {
    ADMIN: 'admin',
    AW_GROUP: 'aw_group',
    PLANNING_GROUP: 'planning_group',
    OPERATOR: 'operator',
    OBSERVER: 'observer'
};

const ROLE_HIERARCHY = {
    'admin': 100,
    'aw_group': 80,
    'planning_group': 70,
    'operator': 60,
    'observer': 50
};

const ROLE_PERMISSIONS = {
    // Admin: Everything
    'admin': {
        canUploadAW: true,
        canUploadPL: true,
        canEditAWStatus: true,
        canEditPLStatus: true,
        canEditSchedule: true,
        canEditSpeed: true,
        canEditSetup: true,
        canEditQuantity: true,
        canDeleteJob: true,
        canFlushData: true,
        canExport: true,
        canManageUsers: true,
        canViewAll: true,
        canChangePriority: true,
        canChangeColor: true,
        canChangeMachine: true
    },
    // AW Group: Upload AW, Export
    'aw_group': {
        canUploadAW: true,
        canUploadPL: false,
        canEditAWStatus: true,
        canEditPLStatus: false,
        canEditSchedule: false,
        canEditSpeed: false,
        canEditSetup: false,
        canEditQuantity: false,
        canDeleteJob: false,
        canFlushData: false,
        canExport: true,
        canManageUsers: false,
        canViewAll: true,
        canChangePriority: false,
        canChangeColor: false,
        canChangeMachine: false
    },
    // Planning Group: Upload PL, Change most things except AW Status
    'planning_group': {
        canUploadAW: false,
        canUploadPL: true,
        canEditAWStatus: false,
        canEditPLStatus: true,
        canEditSchedule: true,
        canEditSpeed: true,
        canEditSetup: true,
        canEditQuantity: true,
        canDeleteJob: false,
        canFlushData: false,
        canExport: true,
        canManageUsers: false,
        canViewAll: true,
        canChangePriority: true,
        canChangeColor: true,
        canChangeMachine: true
    },
    // Operators: Edit schedule, PL Status
    'operator': {
        canUploadAW: false,
        canUploadPL: false,
        canEditAWStatus: false,
        canEditPLStatus: true,
        canEditSchedule: true,
        canEditSpeed: false,
        canEditSetup: false,
        canEditQuantity: false,
        canDeleteJob: false,
        canFlushData: false,
        canExport: false,
        canManageUsers: false,
        canViewAll: true,
        canChangePriority: false,
        canChangeColor: false,
        canChangeMachine: false
    },
    // Observer: View only
    'observer': {
        canUploadAW: false,
        canUploadPL: false,
        canEditAWStatus: false,
        canEditPLStatus: false,
        canEditSchedule: false,
        canEditSpeed: false,
        canEditSetup: false,
        canEditQuantity: false,
        canDeleteJob: false,
        canFlushData: false,
        canExport: false,
        canManageUsers: false,
        canViewAll: true,
        canChangePriority: false,
        canChangeColor: false,
        canChangeMachine: false
    }
};

// ============================================================
// AUTH STATE
// ============================================================
let currentUser = null;
let currentUserProfile = null;
let authInitialized = false;
let authStateChangeListeners = [];

// ============================================================
// INITIALIZE AUTH
// ============================================================
async function initAuth() {
    console.log('🔐 Initializing authentication...');
    
    const client = initSupabase();
    if (!client) {
        console.error('❌ Supabase client not available');
        return false;
    }
    
    try {
        // Get current session
        const { data: { session }, error: sessionError } = await client.auth.getSession();
        
        if (sessionError) {
            console.error('❌ Session error:', sessionError);
            return false;
        }
        
        if (session) {
            currentUser = session.user;
            console.log(`✅ User authenticated: ${currentUser.email}`);
            
            // Load user profile
            await loadUserProfile(currentUser.id);
            
            // Update upload status with user info
            if (currentUserProfile) {
                updateUploaderName(currentUserProfile);
            }
        } else {
            console.log('ℹ️ No active session');
            // Show login UI
            showLoginUI();
        }
        
        // Set up auth state listener
        setupAuthListener();
        
        authInitialized = true;
        return true;
        
    } catch (error) {
        console.error('❌ Auth initialization error:', error);
        return false;
    }
}

// ============================================================
// SETUP AUTH LISTENER
// ============================================================
function setupAuthListener() {
    const client = initSupabase();
    if (!client) return;
    
    client.auth.onAuthStateChange((event, session) => {
        console.log(`🔐 Auth event: ${event}`);
        
        if (event === 'SIGNED_IN' && session) {
            currentUser = session.user;
            loadUserProfile(currentUser.id);
            notifyAuthChange('signed_in', currentUser);
            hideLoginUI();
            showNotification(`✅ Welcome, ${currentUser.email}!`, 'success');
        } else if (event === 'SIGNED_OUT') {
            currentUser = null;
            currentUserProfile = null;
            notifyAuthChange('signed_out', null);
            showLoginUI();
        } else if (event === 'TOKEN_REFRESHED') {
            console.log('🔄 Token refreshed');
        } else if (event === 'USER_UPDATED') {
            if (session) {
                currentUser = session.user;
                loadUserProfile(currentUser.id);
            }
        }
    });
}

// ============================================================
// LOAD USER PROFILE
// ============================================================
async function loadUserProfile(userId) {
    try {
        const client = initSupabase();
        const { data, error } = await client
            .from('user_profiles')
            .select('*')
            .eq('user_id', userId)
            .single();
        
        if (error) {
            console.warn('⚠️ No profile found for user, creating default...');
            // Create default profile
            if (currentUser) {
                const newProfile = await createDefaultProfile(currentUser);
                currentUserProfile = newProfile;
                return;
            }
            return null;
        }
        
        currentUserProfile = data;
        console.log(`✅ User profile loaded: ${data.display_name} (${data.role})`);
        
        // Apply permissions to UI
        applyPermissions();
        
        return data;
        
    } catch (error) {
        console.error('❌ Error loading user profile:', error);
        return null;
    }
}

// ============================================================
// CREATE DEFAULT PROFILE
// ============================================================
async function createDefaultProfile(user) {
    try {
        const client = initSupabase();
        const newProfile = {
            user_id: user.id,
            email: user.email,
            display_name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'User',
            role: 'observer',
            is_active: true,
            created_at: new Date().toISOString()
        };
        
        const { data, error } = await client
            .from('user_profiles')
            .insert(newProfile)
            .select()
            .single();
        
        if (error) throw error;
        
        currentUserProfile = data;
        console.log(`✅ Default profile created for ${user.email} (observer)`);
        return data;
        
    } catch (error) {
        console.error('❌ Error creating default profile:', error);
        return null;
    }
}

// ============================================================
// UPDATE UPLOADER NAME
// ============================================================
function updateUploaderName(profile) {
    // Map user email/name to uploader
    const email = profile.email?.toLowerCase() || '';
    const name = profile.display_name?.toLowerCase() || '';
    
    let uploader = null;
    if (email.includes('mahmoud') || name.includes('mahmoud')) uploader = 'mahmoud';
    else if (email.includes('raed') || name.includes('raed')) uploader = 'raed';
    else if (email.includes('rabia') || name.includes('rabia')) uploader = 'rabia';
    else if (email.includes('qasem') || name.includes('qasem')) uploader = 'qasem';
    
    if (uploader && window.uploadStatus && window.uploadStatus[uploader]) {
        window.uploadStatus[uploader].userProfile = profile;
        console.log(`✅ Mapped user ${profile.display_name} to uploader: ${uploader}`);
    }
}

// ============================================================
// PERMISSION CHECKS
// ============================================================
function hasPermission(permission) {
    if (!currentUserProfile) return false;
    const role = currentUserProfile.role;
    const permissions = ROLE_PERMISSIONS[role];
    if (!permissions) return false;
    return permissions[permission] === true;
}

function getCurrentRole() {
    return currentUserProfile?.role || 'observer';
}

function getCurrentPermissions() {
    const role = getCurrentRole();
    return ROLE_PERMISSIONS[role] || ROLE_PERMISSIONS['observer'];
}

function isAdmin() {
    return getCurrentRole() === 'admin';
}

function isAWGroup() {
    const role = getCurrentRole();
    return role === 'admin' || role === 'aw_group';
}

function isPlanningGroup() {
    const role = getCurrentRole();
    return role === 'admin' || role === 'planning_group';
}

function isOperator() {
    const role = getCurrentRole();
    return role === 'admin' || role === 'operator' || role === 'planning_group';
}

function isObserver() {
    const role = getCurrentRole();
    return role === 'observer';
}

function canUploadAW() {
    return hasPermission('canUploadAW');
}

function canUploadPL() {
    return hasPermission('canUploadPL');
}

function canEditAWStatus() {
    return hasPermission('canEditAWStatus');
}

function canEditPLStatus() {
    return hasPermission('canEditPLStatus');
}

function canEditSchedule() {
    return hasPermission('canEditSchedule');
}

function canEditSpeed() {
    return hasPermission('canEditSpeed');
}

function canEditSetup() {
    return hasPermission('canEditSetup');
}

function canEditQuantity() {
    return hasPermission('canEditQuantity');
}

function canFlushData() {
    return hasPermission('canFlushData');
}

function canExport() {
    return hasPermission('canExport');
}

function canManageUsers() {
    return hasPermission('canManageUsers');
}

function canChangePriority() {
    return hasPermission('canChangePriority');
}

function canChangeColor() {
    return hasPermission('canChangeColor');
}

function canChangeMachine() {
    return hasPermission('canChangeMachine');
}

// ============================================================
// APPLY PERMISSIONS TO UI
// ============================================================
function applyPermissions() {
    if (!currentUserProfile) return;
    
    const role = currentUserProfile.role;
    console.log(`🔐 Applying permissions for role: ${role}`);
    
    // ============================================================
    // Upload buttons
    // ============================================================
    const uploadBtnAW = document.getElementById('upload-excel-aw');
    if (uploadBtnAW) {
        uploadBtnAW.style.display = canUploadAW() ? 'inline-block' : 'none';
        uploadBtnAW.title = canUploadAW() ? 'Upload AW file' : 'You don\'t have permission to upload AW files';
    }
    
    const uploadBtnPL = document.getElementById('upload-excel-pl');
    if (uploadBtnPL) {
        uploadBtnPL.style.display = canUploadPL() ? 'inline-block' : 'none';
        uploadBtnPL.title = canUploadPL() ? 'Upload PL file' : 'You don\'t have permission to upload PL files';
    }
    
    // ============================================================
    // Export button
    // ============================================================
    const exportBtn = document.getElementById('export-pl-btn');
    if (exportBtn) {
        exportBtn.style.display = canExport() ? 'inline-block' : 'none';
    }
    
    // ============================================================
    // Emergency flush button
    // ============================================================
    const flushBtn = document.getElementById('emergency-flush-btn');
    if (flushBtn) {
        flushBtn.style.display = canFlushData() ? 'inline-block' : 'none';
    }
    
    // ============================================================
    // User management button (admin only)
    // ============================================================
    const userMgmtBtn = document.getElementById('user-management-btn');
    if (userMgmtBtn) {
        userMgmtBtn.style.display = canManageUsers() ? 'inline-block' : 'none';
    }
    
    // ============================================================
    // Disable inputs based on permissions
    // ============================================================
    document.querySelectorAll('.job-editable-fields input').forEach(input => {
        const isDisabled = !canEditSetup() || !canEditQuantity();
        if (isDisabled && !input.disabled) {
            input.disabled = true;
            input.style.backgroundColor = '#e9ecef';
            input.style.cursor = 'not-allowed';
            input.style.opacity = '0.7';
        }
    });
    
    // ============================================================
    // Show/hide priority badge editing
    // ============================================================
    document.querySelectorAll('.job-priority-badge').forEach(badge => {
        if (!canChangePriority()) {
            badge.style.opacity = '0.6';
            badge.title = 'Priority changes not allowed';
        }
    });
    
    // ============================================================
    // Update role indicator
    // ============================================================
    updateRoleIndicator();
}

// ============================================================
// UPDATE ROLE INDICATOR
// ============================================================
function updateRoleIndicator() {
    let roleIndicator = document.getElementById('role-indicator');
    if (!roleIndicator) {
        roleIndicator = document.createElement('div');
        roleIndicator.id = 'role-indicator';
        document.querySelector('.header')?.appendChild(roleIndicator);
    }
    
    const role = getCurrentRole();
    const displayName = currentUserProfile?.display_name || 'User';
    const roleDisplay = role.charAt(0).toUpperCase() + role.slice(1).replace('_', ' ');
    
    roleIndicator.innerHTML = `
        <span class="role-badge role-${role}">
            👤 ${displayName} 
            <span class="role-name">(${roleDisplay})</span>
        </span>
        <button class="logout-btn" onclick="logout()" title="Sign out">
            <i class="fas fa-sign-out-alt"></i>
        </button>
    `;
    
    // Add styles if not present
    if (!document.getElementById('auth-styles')) {
        const style = document.createElement('style');
        style.id = 'auth-styles';
        style.textContent = `
            #role-indicator {
                display: flex;
                align-items: center;
                gap: 10px;
                margin-left: auto;
                padding: 4px 12px;
                background: rgba(255,255,255,0.1);
                border-radius: 20px;
                backdrop-filter: blur(4px);
            }
            .role-badge {
                font-size: 13px;
                color: #2c3e50;
                display: flex;
                align-items: center;
                gap: 4px;
            }
            .role-name {
                font-weight: 600;
                font-size: 11px;
                text-transform: uppercase;
                padding: 2px 8px;
                border-radius: 12px;
                background: rgba(0,0,0,0.08);
            }
            .role-admin .role-name { color: #dc3545; }
            .role-aw_group .role-name { color: #17a2b8; }
            .role-planning_group .role-name { color: #fd7e14; }
            .role-operator .role-name { color: #28a745; }
            .role-observer .role-name { color: #6c757d; }
            .logout-btn {
                background: none;
                border: none;
                color: #6c757d;
                cursor: pointer;
                padding: 4px 8px;
                border-radius: 4px;
                transition: all 0.2s;
            }
            .logout-btn:hover {
                background: rgba(220, 53, 69, 0.1);
                color: #dc3545;
            }
        `;
        document.head.appendChild(style);
    }
}

// ============================================================
// LOGIN / LOGOUT
// ============================================================
async function login(email, password) {
    try {
        const client = initSupabase();
        const { data, error } = await client.auth.signInWithPassword({
            email: email,
            password: password
        });
        
        if (error) throw error;
        
        currentUser = data.user;
        await loadUserProfile(currentUser.id);
        notifyAuthChange('signed_in', currentUser);
        hideLoginUI();
        showNotification(`✅ Welcome, ${currentUserProfile?.display_name || email}!`, 'success');
        return true;
        
    } catch (error) {
        console.error('❌ Login error:', error);
        showNotification(`❌ Login failed: ${error.message}`, 'error');
        return false;
    }
}

async function logout() {
    try {
        const client = initSupabase();
        await client.auth.signOut();
        currentUser = null;
        currentUserProfile = null;
        notifyAuthChange('signed_out', null);
        showLoginUI();
        showNotification('👋 Signed out successfully', 'info');
        return true;
    } catch (error) {
        console.error('❌ Logout error:', error);
        return false;
    }
}

// ============================================================
// LOGIN UI
// ============================================================
function showLoginUI() {
    let loginOverlay = document.getElementById('login-overlay');
    
    if (!loginOverlay) {
        loginOverlay = document.createElement('div');
        loginOverlay.id = 'login-overlay';
        loginOverlay.innerHTML = `
            <div class="login-modal">
                <div class="login-header">
                    <h2>🏭 Planning Monitor</h2>
                    <p>Please sign in to continue</p>
                </div>
                <form id="login-form" onsubmit="handleLogin(event)">
                    <div class="login-field">
                        <label for="login-email">Email</label>
                        <input type="email" id="login-email" placeholder="Enter your email" required autofocus>
                    </div>
                    <div class="login-field">
                        <label for="login-password">Password</label>
                        <input type="password" id="login-password" placeholder="Enter your password" required>
                    </div>
                    <button type="submit" class="login-btn">Sign In</button>
                    <div class="login-error" id="login-error"></div>
                    <div class="login-help">
                        <small>Contact your administrator if you need access</small>
                    </div>
                </form>
            </div>
        `;
        document.body.prepend(loginOverlay);
        
        // Add login styles
        if (!document.getElementById('login-styles')) {
            const style = document.createElement('style');
            style.id = 'login-styles';
            style.textContent = `
                #login-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 10000;
                    backdrop-filter: blur(8px);
                }
                #login-overlay.hidden {
                    display: none;
                }
                .login-modal {
                    background: white;
                    border-radius: 20px;
                    padding: 48px 40px;
                    width: 100%;
                    max-width: 420px;
                    box-shadow: 0 20px 60px rgba(0,0,0,0.3);
                    animation: loginFadeIn 0.5s ease;
                }
                @keyframes loginFadeIn {
                    from { opacity: 0; transform: translateY(-20px) scale(0.95); }
                    to { opacity: 1; transform: translateY(0) scale(1); }
                }
                .login-header {
                    text-align: center;
                    margin-bottom: 32px;
                }
                .login-header h2 {
                    font-size: 24px;
                    color: #2c3e50;
                    margin: 0 0 8px 0;
                }
                .login-header p {
                    color: #6c757d;
                    margin: 0;
                    font-size: 14px;
                }
                .login-field {
                    margin-bottom: 20px;
                }
                .login-field label {
                    display: block;
                    font-size: 13px;
                    font-weight: 600;
                    color: #2c3e50;
                    margin-bottom: 4px;
                }
                .login-field input {
                    width: 100%;
                    padding: 12px 16px;
                    border: 2px solid #e9ecef;
                    border-radius: 10px;
                    font-size: 14px;
                    transition: border-color 0.2s;
                    box-sizing: border-box;
                }
                .login-field input:focus {
                    outline: none;
                    border-color: #667eea;
                }
                .login-btn {
                    width: 100%;
                    padding: 14px;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    border: none;
                    border-radius: 10px;
                    font-size: 16px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: transform 0.2s, box-shadow 0.2s;
                }
                .login-btn:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 8px 25px rgba(102, 126, 234, 0.4);
                }
                .login-btn:active {
                    transform: translateY(0);
                }
                .login-error {
                    color: #dc3545;
                    font-size: 13px;
                    margin-top: 12px;
                    text-align: center;
                    min-height: 20px;
                }
                .login-help {
                    text-align: center;
                    margin-top: 16px;
                    color: #6c757d;
                }
            `;
            document.head.appendChild(style);
        }
        
        // Handle Enter key for login
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Enter' && !document.getElementById('login-overlay').classList.contains('hidden')) {
                e.preventDefault();
                handleLogin(e);
            }
        });
    }
    
    loginOverlay.classList.remove('hidden');
    // Focus email field
    setTimeout(() => {
        document.getElementById('login-email')?.focus();
    }, 100);
}

function hideLoginUI() {
    const loginOverlay = document.getElementById('login-overlay');
    if (loginOverlay) {
        loginOverlay.classList.add('hidden');
    }
}

async function handleLogin(event) {
    event.preventDefault();
    
    const email = document.getElementById('login-email')?.value;
    const password = document.getElementById('login-password')?.value;
    const errorEl = document.getElementById('login-error');
    
    if (!email || !password) {
        if (errorEl) errorEl.textContent = 'Please enter email and password';
        return;
    }
    
    // Show loading
    const btn = document.querySelector('.login-btn');
    if (btn) {
        btn.textContent = 'Signing in...';
        btn.disabled = true;
    }
    
    const success = await login(email, password);
    
    if (btn) {
        btn.textContent = 'Sign In';
        btn.disabled = false;
    }
    
    if (!success) {
        if (errorEl) {
            errorEl.textContent = 'Invalid email or password. Please try again.';
        }
    }
}

// ============================================================
// NOTIFY AUTH CHANGE
// ============================================================
function notifyAuthChange(event, user) {
    authStateChangeListeners.forEach(listener => {
        try {
            listener(event, user);
        } catch (e) {
            console.warn('Auth listener error:', e);
        }
    });
}

function addAuthListener(listener) {
    authStateChangeListeners.push(listener);
}

// ============================================================
// USER MANAGEMENT (Admin only)
// ============================================================
async function getUsers() {
    try {
        const client = initSupabase();
        const { data, error } = await client
            .from('user_profiles')
            .select('*')
            .order('display_name');
        
        if (error) throw error;
        return data;
    } catch (error) {
        console.error('❌ Error getting users:', error);
        return [];
    }
}

async function updateUserRole(userId, newRole) {
    if (!isAdmin()) {
        showNotification('❌ Only admins can change user roles', 'error');
        return false;
    }
    
    try {
        const client = initSupabase();
        const { error } = await client
            .from('user_profiles')
            .update({ role: newRole, updated_at: new Date().toISOString() })
            .eq('user_id', userId);
        
        if (error) throw error;
        showNotification('✅ User role updated successfully', 'success');
        return true;
    } catch (error) {
        console.error('❌ Error updating user role:', error);
        showNotification(`❌ Error: ${error.message}`, 'error');
        return false;
    }
}

async function toggleUserActive(userId, isActive) {
    if (!isAdmin()) {
        showNotification('❌ Only admins can change user status', 'error');
        return false;
    }
    
    try {
        const client = initSupabase();
        const { error } = await client
            .from('user_profiles')
            .update({ is_active: isActive, updated_at: new Date().toISOString() })
            .eq('user_id', userId);
        
        if (error) throw error;
        showNotification(`✅ User ${isActive ? 'activated' : 'deactivated'} successfully`, 'success');
        return true;
    } catch (error) {
        console.error('❌ Error toggling user status:', error);
        showNotification(`❌ Error: ${error.message}`, 'error');
        return false;
    }
}

// ============================================================
// PASSWORD CHANGE MODAL - For first-time login
// ============================================================

let tempPasswordUser = null;

// ============================================================
// PASSWORD CHANGE MODAL - FIXED VERSION
// ============================================================

function showPasswordChangeModal(user, isFirstLogin = false) {
    tempPasswordUser = user;
    
    console.log('📱 Showing password change modal...');
    console.log('Is first login:', isFirstLogin);
    
    // First, HIDE the login overlay completely
    const loginOverlay = document.getElementById('login-overlay');
    if (loginOverlay) {
        loginOverlay.style.display = 'none';
        loginOverlay.classList.add('hidden');
        console.log('✅ Login overlay hidden');
    }
    
    let modal = document.getElementById('password-change-modal');
    if (!modal) {
        console.error('❌ Password change modal not found in DOM');
        showNotification('❌ Error: Password change form not found', 'error');
        return;
    }
    
    // Update message based on first login
    const messageEl = document.getElementById('password-change-message');
    if (messageEl) {
        messageEl.textContent = isFirstLogin ? 
            'Welcome! Please set your password to continue.' : 
            'Change your password';
    }
    
    // Show/hide current password field
    const currentPwdField = document.getElementById('current-password-field');
    const currentPwdInput = document.getElementById('current-password');
    const cancelBtn = document.getElementById('password-cancel-btn');
    const saveBtn = document.getElementById('password-save-btn');
    
    if (isFirstLogin) {
        if (currentPwdField) currentPwdField.style.display = 'none';
        if (currentPwdInput) currentPwdInput.required = false;
        if (cancelBtn) cancelBtn.style.display = 'none';
        if (saveBtn) saveBtn.textContent = 'Set Password & Continue';
    } else {
        if (currentPwdField) currentPwdField.style.display = 'block';
        if (currentPwdInput) currentPwdInput.required = true;
        if (cancelBtn) cancelBtn.style.display = 'block';
        if (saveBtn) saveBtn.textContent = 'Update Password';
    }
    
    // Clear any previous errors
    const errorEl = document.getElementById('password-change-error');
    if (errorEl) errorEl.textContent = '';
    
    // Reset form fields
    const newPwdInput = document.getElementById('new-password');
    const confirmPwdInput = document.getElementById('confirm-password');
    if (newPwdInput) newPwdInput.value = '';
    if (confirmPwdInput) confirmPwdInput.value = '';
    if (currentPwdInput) currentPwdInput.value = '';
    
    // Reset strength bar
    const strengthBar = document.querySelector('.strength-bar');
    if (strengthBar) strengthBar.style.width = '0%';
    const strengthText = document.getElementById('strength-text');
    if (strengthText) strengthText.textContent = '';
    
    // Show the modal
    modal.style.display = 'block';
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
    
    // Focus first input
    setTimeout(() => {
        if (!isFirstLogin && currentPwdInput) {
            currentPwdInput.focus();
        } else if (newPwdInput) {
            newPwdInput.focus();
        }
    }, 300);
}

// Override the close function to restore login if needed
function closePasswordChangeModal() {
    const modal = document.getElementById('password-change-modal');
    if (modal) {
        modal.style.display = 'none';
        modal.classList.remove('active');
        document.body.style.overflow = '';
    }
    
    // If user is not logged in, show login overlay again
    if (!currentUser) {
        const loginOverlay = document.getElementById('login-overlay');
        if (loginOverlay) {
            loginOverlay.style.display = 'flex';
            loginOverlay.classList.remove('hidden');
        }
    }
}

function updatePasswordStrength(password) {
    const strengthBar = document.querySelector('.password-strength');
    if (!strengthBar) return;
    
    let bar = strengthBar.querySelector('.strength-bar');
    if (!bar) {
        bar = document.createElement('div');
        bar.className = 'strength-bar';
        strengthBar.appendChild(bar);
    }
    
    let strength = 0;
    let color = '#dc3545';
    let text = 'Weak';
    
    if (password.length >= 8) strength += 25;
    if (password.length >= 12) strength += 15;
    if (/[A-Z]/.test(password)) strength += 20;
    if (/[a-z]/.test(password)) strength += 15;
    if (/[0-9]/.test(password)) strength += 15;
    if (/[^A-Za-z0-9]/.test(password)) strength += 10;
    
    strength = Math.min(100, strength);
    
    if (strength < 30) { color = '#dc3545'; text = 'Weak'; }
    else if (strength < 50) { color = '#fd7e14'; text = 'Fair'; }
    else if (strength < 70) { color = '#ffc107'; text = 'Good'; }
    else if (strength < 90) { color = '#17a2b8'; text = 'Strong'; }
    else { color = '#28a745'; text = 'Very Strong'; }
    
    bar.style.width = strength + '%';
    bar.style.background = color;
    
    let textEl = strengthBar.parentElement.querySelector('.password-strength-text');
    if (!textEl) {
        textEl = document.createElement('div');
        textEl.className = 'password-strength-text';
        strengthBar.parentElement.appendChild(textEl);
    }
    textEl.textContent = password.length > 0 ? `Strength: ${text} (${strength}%)` : '';
    textEl.style.color = color;
}

// ============================================================
// HANDLE PASSWORD CHANGE - FIXED VERSION
// ============================================================

async function handlePasswordChange(event) {
    event.preventDefault();
    
    const newPassword = document.getElementById('new-password').value;
    const confirmPassword = document.getElementById('confirm-password').value;
    const currentPassword = document.getElementById('current-password').value;
    const errorEl = document.getElementById('password-change-error');
    const saveBtn = document.getElementById('password-save-btn');
    
    // Clear previous errors
    if (errorEl) errorEl.textContent = '';
    
    // Validate
    if (newPassword.length < 6) {
        if (errorEl) errorEl.textContent = 'Password must be at least 6 characters';
        return;
    }
    
    if (newPassword !== confirmPassword) {
        if (errorEl) errorEl.textContent = 'Passwords do not match';
        return;
    }
    
    // Check if it's first login (current password field hidden)
    const currentPwdField = document.getElementById('current-password-field');
    const isFirstLogin = currentPwdField && currentPwdField.style.display === 'none';
    
    // Disable button
    if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.textContent = 'Updating...';
    }
    
    try {
        const client = initSupabase();
        let success = false;
        let errorMessage = '';
        
        if (isFirstLogin) {
            console.log('🔐 First login - setting password...');
            
            // Try multiple methods for first login
            try {
                // Method 1: Try updateUser with just password
                const { error } = await client.auth.updateUser({
                    password: newPassword
                });
                
                if (error) {
                    console.warn('Method 1 failed:', error.message);
                    
                    // Method 2: Try with current password (if available)
                    if (currentPassword) {
                        const { error: pwdError } = await client.auth.updateUser({
                            password: newPassword,
                            currentPassword: currentPassword
                        });
                        if (pwdError) throw pwdError;
                        success = true;
                    } else {
                        // Method 3: Try using the session token
                        const session = await client.auth.getSession();
                        if (session.data.session) {
                            const { error: sessionError } = await client.auth.updateUser({
                                password: newPassword
                            });
                            if (sessionError) throw sessionError;
                            success = true;
                        } else {
                            throw new Error('No active session found');
                        }
                    }
                } else {
                    success = true;
                }
                
            } catch (error) {
                console.error('All password update methods failed:', error);
                errorMessage = error.message || 'Failed to set password';
                success = false;
            }
            
        } else {
            // Regular password change with current password
            console.log('🔐 Changing password with current password...');
            const { error } = await client.auth.updateUser({
                password: newPassword,
                currentPassword: currentPassword
            });
            
            if (error) {
                // Try without current password as fallback
                const { error: fallbackError } = await client.auth.updateUser({
                    password: newPassword
                });
                if (fallbackError) throw fallbackError;
                success = true;
            } else {
                success = true;
            }
        }
        
        if (success) {
            console.log('✅ Password updated successfully!');
            
            // Show success
            const box = document.querySelector('.password-change-box');
            if (box) {
                box.innerHTML = `
                    <div class="password-success">
                        <span class="checkmark">✅</span>
                        <h3>Password Updated!</h3>
                        <p>${isFirstLogin ? 'Your password has been set successfully. You can now use the application.' : 'Your password has been changed successfully.'}</p>
                        <button class="btn-password-save" onclick="handlePasswordChangeSuccess()" style="margin-top: 20px; padding: 12px 40px;">
                            ${isFirstLogin ? 'Continue to App' : 'Done'}
                        </button>
                    </div>
                `;
            }
            
            showNotification(`✅ ${isFirstLogin ? 'Password set' : 'Password updated'} successfully!`, 'success');
            
            // Update profile to mark password as set
            try {
                await client
                    .from('user_profiles')
                    .update({ 
                        password_set: true,
                        updated_at: new Date().toISOString()
                    })
                    .eq('user_id', currentUser.id);
                console.log('✅ Password_set flag updated in profile');
            } catch (e) {
                console.warn('Could not update password_set flag:', e);
            }
            
            // Auto close after 3 seconds
            setTimeout(() => {
                if (document.querySelector('.password-success')) {
                    handlePasswordChangeSuccess();
                }
            }, 3000);
        } else {
            throw new Error(errorMessage || 'Failed to update password');
        }
        
    } catch (error) {
        console.error('❌ Password change error:', error);
        if (errorEl) {
            errorEl.textContent = error.message || 'Failed to update password. Please try again.';
        }
        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.textContent = isFirstLogin ? 'Set Password & Continue' : 'Update Password';
        }
    }
}

// ============================================================
// HANDLE PASSWORD CHANGE SUCCESS
// ============================================================
function handlePasswordChangeSuccess() {
    console.log('✅ Password change successful, closing modal...');
    closePasswordChangeModal();
    
    // Make sure login overlay stays hidden
    const loginOverlay = document.getElementById('login-overlay');
    if (loginOverlay) {
        loginOverlay.style.display = 'none';
        loginOverlay.classList.add('hidden');
    }
    
    // Show a welcome notification
    showNotification(`✅ Welcome to Planning Monitor, ${currentUserProfile?.display_name || 'User'}!`, 'success');
    
    // Reload the page to refresh the application state
    setTimeout(() => {
        window.location.reload();
    }, 1500);
}

// ============================================================
// CHECK IF PASSWORD CHANGE IS REQUIRED - FIXED
// ============================================================

async function checkPasswordChangeRequired() {
    console.log('🔐 Checking if password change is required...');
    
    if (!currentUser || !currentUserProfile) {
        console.log('⚠️ No user or profile found');
        return false;
    }
    
    console.log('📊 User profile:', currentUserProfile);
    console.log('📊 User metadata:', currentUser?.user_metadata);
    
    // Check multiple conditions for first login
    const needsPasswordSet = 
        currentUserProfile.password_set === false ||
        currentUserProfile.password_set === null ||
        currentUserProfile.password_set === undefined ||
        currentUser?.user_metadata?.first_login === true;
    
    console.log(`🔐 Password set flag: ${currentUserProfile.password_set}`);
    console.log(`🔐 First login flag: ${currentUser?.user_metadata?.first_login}`);
    console.log(`🔐 Needs password set: ${needsPasswordSet}`);
    
    if (needsPasswordSet) {
        console.log('🔐 Password change required for first login');
        
        // Show modal with slight delay - HIDE login overlay first
        setTimeout(() => {
            // Make sure login overlay is hidden
            const loginOverlay = document.getElementById('login-overlay');
            if (loginOverlay) {
                loginOverlay.style.display = 'none';
                loginOverlay.classList.add('hidden');
            }
            
            showPasswordChangeModal(currentUser, true);
        }, 800);
        return true;
    }
    
    return false;
}

// Override the login function to check for password change
const originalLogin = login;
login = async function(email, password) {
    try {
        const client = initSupabase();
        const { data, error } = await client.auth.signInWithPassword({
            email: email,
            password: password
        });
        
        if (error) throw error;
        
        currentUser = data.user;
        await loadUserProfile(currentUser.id);
        notifyAuthChange('signed_in', currentUser);
        hideLoginUI();
        showNotification(`✅ Welcome, ${currentUserProfile?.display_name || email}!`, 'success');
        
        // Check if password change is required
        setTimeout(async () => {
            await checkPasswordChangeRequired();
        }, 500);
        
        return true;
        
    } catch (error) {
        console.error('❌ Login error:', error);
        showNotification(`❌ Login failed: ${error.message}`, 'error');
        return false;
    }
};

// Also check after auth state changes
const originalAuthListener = setupAuthListener;
setupAuthListener = function() {
    const client = initSupabase();
    if (!client) return;
    
    client.auth.onAuthStateChange((event, session) => {
        console.log(`🔐 Auth event: ${event}`);
        
        if (event === 'SIGNED_IN' && session) {
            currentUser = session.user;
            loadUserProfile(currentUser.id).then(() => {
                notifyAuthChange('signed_in', currentUser);
                hideLoginUI();
                showNotification(`✅ Welcome, ${currentUser.email}!`, 'success');
                // Check if password change is required
                checkPasswordChangeRequired();
            });
        } else if (event === 'SIGNED_OUT') {
            currentUser = null;
            currentUserProfile = null;
            notifyAuthChange('signed_out', null);
            showLoginUI();
        } else if (event === 'TOKEN_REFRESHED') {
            console.log('🔄 Token refreshed');
        } else if (event === 'USER_UPDATED') {
            if (session) {
                currentUser = session.user;
                loadUserProfile(currentUser.id);
            }
        }
    });
};

// Add password_set column to user_profiles if not exists
async function ensurePasswordSetColumn() {
    try {
        const client = initSupabase();
        // Check if column exists by trying to select it
        const { error } = await client
            .from('user_profiles')
            .select('password_set')
            .limit(1);
        
        if (error && error.message.includes('column "password_set" does not exist')) {
            // Column doesn't exist, add it via SQL
            console.log('📝 Adding password_set column to user_profiles...');
            // This would need to be done via SQL editor or RPC
            // For now, we'll handle it gracefully
        }
    } catch (e) {
        console.warn('Could not check password_set column:', e);
    }
}

// ============================================================
// USER MANAGEMENT (Admin only)
// ============================================================

async function createUser(email, password, displayName, role, uploader = null) {
    if (!isAdmin()) {
        showNotification('❌ Only admins can create users', 'error');
        return false;
    }
    
    try {
        const client = initSupabase();
        
        // Create user in auth
        const { data: userData, error: userError } = await client.auth.admin.createUser({
            email: email,
            password: password,
            email_confirm: true,
            user_metadata: {
                full_name: displayName,
                first_login: true  // Mark as first login
            }
        });
        
        if (userError) throw userError;
        
        // Create profile
        const { error: profileError } = await client
            .from('user_profiles')
            .insert({
                user_id: userData.user.id,
                email: email,
                display_name: displayName,
                role: role,
                uploader: uploader,
                password_set: false,  // User needs to set password
                is_active: true
            });
        
        if (profileError) throw profileError;
        
        showNotification(`✅ User ${email} created successfully. They will need to set their password on first login.`, 'success');
        return true;
        
    } catch (error) {
        console.error('❌ Error creating user:', error);
        showNotification(`❌ Error: ${error.message}`, 'error');
        return false;
    }
}

// Expose create user function
window.createUser = createUser;


// Call this on init
setTimeout(ensurePasswordSetColumn, 1000);

// Expose password change functions
window.showPasswordChangeModal = showPasswordChangeModal;
window.closePasswordChangeModal = closePasswordChangeModal;
window.handlePasswordChange = handlePasswordChange;
window.checkPasswordChangeRequired = checkPasswordChangeRequired;
window.updatePasswordStrength = updatePasswordStrength;

console.log('✅ Password change module loaded');

// ============================================================
// INITIALIZE AUTH ON LOAD
// ============================================================
document.addEventListener('DOMContentLoaded', function() {
    // Initialize auth after a short delay to allow other scripts to load
    setTimeout(async () => {
        await initAuth();
    }, 500);
});

// Expose functions to window
window.initAuth = initAuth;
window.login = login;
window.logout = logout;
window.handleLogin = handleLogin;
window.showLoginUI = showLoginUI;
window.hideLoginUI = hideLoginUI;
window.hasPermission = hasPermission;
window.isAdmin = isAdmin;
window.isAWGroup = isAWGroup;
window.isPlanningGroup = isPlanningGroup;
window.isOperator = isOperator;
window.isObserver = isObserver;
window.canUploadAW = canUploadAW;
window.canUploadPL = canUploadPL;
window.canEditAWStatus = canEditAWStatus;
window.canEditPLStatus = canEditPLStatus;
window.canEditSchedule = canEditSchedule;
window.canEditSpeed = canEditSpeed;
window.canEditSetup = canEditSetup;
window.canEditQuantity = canEditQuantity;
window.canFlushData = canFlushData;
window.canExport = canExport;
window.canManageUsers = canManageUsers;
window.canChangePriority = canChangePriority;
window.canChangeColor = canChangeColor;
window.canChangeMachine = canChangeMachine;
window.getCurrentRole = getCurrentRole;
window.getCurrentPermissions = getCurrentPermissions;
window.getUsers = getUsers;
window.updateUserRole = updateUserRole;
window.toggleUserActive = toggleUserActive;
window.addAuthListener = addAuthListener;
window.currentUser = currentUser;
window.currentUserProfile = currentUserProfile;

console.log('✅ auth.js loaded - Authentication module ready');
