// script.js
// ============================================================
// JOB DATA STORAGE
// ============================================================
const jobDatabase = {};
const plDatabase = {}; // Store PL data separately
let awData = {}; // Store AW data for status lookup

// ============================================================
// MACHINE CONFIGURATION
// ============================================================
const machineConfig = {
    speed: 200, // meters per minute
    defaultSetup: 120 // default setup time in minutes
};

// Machine ID to number mapping
const machineIdMap = {
    '7': '207',
    '8': '208', 
    '10': '210',
    '11': '211'
};

const machineNumberMap = {
    '207': '7',
    '208': '8',
    '210': '10',
    '211': '11'
};

// ============================================================
// GLOBAL VARIABLES
// ============================================================
let draggedElement = null;
let selectedJob = null;
let nowIndicatorInterval = null;
let jobSchedule = {};
let dragOverElement = null;
let jobSpeeds = {};
let timeUpdateInterval = null;
let timelineScrollInterval = null;

// Machine IDs
const machineIds = ['207', '208', '209', '210', '211'];

// Color scheme for jobs
const jobColors = {
    current: '#f97319', // Orange
    next: '#2aced4',    // Green
    second: '#95a5a6',  // Blue
    future: '#95a5a6',   // Grey
    printed: '#2c3e50'   // Dark - printed jobs
};

// Status color mapping for AW statuses
const statusColorMap = {
    'Missing Data': '#6c757d',
    'Unknown': '#9b59b6',
    '1. Under Job-Study': '#17a2b8',
    '2. Under QC Check': '#fd7e14',
    '3. S.C Approval': '#6f42c1',
    '4. Need S.C Approval': '#dc3545',
    '5. Working on Cromalin': '#e83e8c',
    '6. Need Cromalin Approval': '#20c997',
    '7. Cromalin Approval': '#28a745',
    '8. Repro: Plate Making': '#ffc107',
    '9. Plates are Ready': '#198754',
    'Deleted': '#dc3545',           // AW Deleted
    'On Hold': '#ffc107',
    'Printed': '#2c3e50',
    'Complete': '#2c3e50',
    'Unprinted': '#fd7e14',
    'Planned': '#17a2b8',
    'PL-Deleted': '#c0392b',        // Darker red for PL Deleted
    'PL-Hold': '#e67e22'            // Darker orange for PL Hold
};

const statusDisplayMap = {
    'Missing Data': 'Missing Data',
    'Unknown': 'Unknown',
    '1. Under Job-Study': 'Under Job-Study',
    '2. Under QC Check': 'Under QC Check',
    '3. S.C Approval': 'S.C Approval',
    '4. Need S.C Approval': 'Need S.C Approval',
    '5. Working on Cromalin': 'Working on Cromalin',
    '6. Need Cromalin Approval': 'Need Cromalin Approval',
    '7. Cromalin Approval': 'Cromalin Approval',
    '8. Repro: Plate Making': 'Repro: Plate Making',
    '9. Plates are Ready': 'Plates are Ready',
    'Deleted': 'Deleted',           // AW Deleted
    'On Hold': 'On Hold',
    'Printed': 'Printed',
    'Complete': 'Complete',
    'Unprinted': 'Unprinted',
    'Planned': 'Planned',
    'PL-Deleted': 'Deleted',        // PL Deleted (displayed as "Deleted")
    'PL-Hold': 'Hold'               // PL Hold (displayed as "Hold")
};

// AW Statuses (from AW file)
const AW_STATUSES = [
    'Missing Data',
    'Unknown',  // Added: for jobs in PL but not in AW
    '1. Under Job-Study',
    '2. Under QC Check',
    '3. S.C Approval',
    '4. Need S.C Approval',
    '5. Working on Cromalin',
    '6. Need Cromalin Approval',
    '7. Cromalin Approval',
    '8. Repro: Plate Making',
    '9. Plates are Ready',
    'Deleted',
    'On Hold'
];

// PL Statuses (from PL file)
const PL_STATUSES = [
    'Complete',
    'Planned',
    'Unprinted',
    'PL-Deleted',  // Changed from 'Deleted' to distinguish from AW
    'PL-Hold'      // Changed from 'Hold' to distinguish from AW
];

// All possible statuses for filter
const ALL_STATUSES = [
    ...AW_STATUSES,
    ...PL_STATUSES
];

// Filter state - AW statuses: all checked by default except Missing Data, Deleted, On Hold
// PL statuses: Planned and Unprinted checked by default, Complete unchecked
let filterStatuses = new Set();

// AW statuses: Missing Data, Unknown, Deleted, On Hold unchecked by default
AW_STATUSES.forEach(status => {
    if (status === 'Missing Data' || status === 'Unknown' || status === 'Deleted' || status === 'On Hold') {
        // Unchecked by default
    } else {
        filterStatuses.add(status);
    }
});

// PL statuses: Complete unchecked, Planned and Unprinted checked

PL_STATUSES.forEach(status => {
    if (status === 'Complete' || status === 'PL-Deleted' || status === 'PL-Hold') {
        // Unchecked by default
    } else {
        filterStatuses.add(status);
    }
});

// ============================================================
// NOTIFICATION SYSTEM
// ============================================================
let notificationTimeout = null;

function showNotification(message, type = 'info') {
    // Remove any existing notification
    const existingNotification = document.querySelector('.notification-toast');
    if (existingNotification) {
        existingNotification.remove();
    }
    
    // Clear any pending timeout
    if (notificationTimeout) {
        clearTimeout(notificationTimeout);
        notificationTimeout = null;
    }
    
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification-toast notification-${type}`;
    
    // Set icon based on type
    let icon = 'ℹ️';
    if (type === 'success') icon = '✅';
    else if (type === 'warning') icon = '⚠️';
    else if (type === 'error') icon = '❌';
    
    notification.innerHTML = `
        <div class="notification-content">
            <span class="notification-icon">${icon}</span>
            <span class="notification-message">${message}</span>
            <button class="notification-close">&times;</button>
        </div>
    `;
    
    // Add close button functionality
    const closeBtn = notification.querySelector('.notification-close');
    closeBtn.addEventListener('click', function() {
        notification.classList.remove('notification-show');
        setTimeout(() => notification.remove(), 300);
    });
    
    // Add to body
    document.body.appendChild(notification);
    
    // Trigger show animation
    setTimeout(() => {
        notification.classList.add('notification-show');
    }, 10);
    
    // Auto-hide after 4 seconds
    notificationTimeout = setTimeout(() => {
        notification.classList.remove('notification-show');
        setTimeout(() => notification.remove(), 300);
        notificationTimeout = null;
    }, 4000);
}

// ============================================================
// ZOOM FUNCTIONALITY
// ============================================================
let currentZoomLevel = 1.0;
const MIN_ZOOM = 0.3;
const MAX_ZOOM = 2.5;
const ZOOM_STEP = 0.1;

// ============================================================
// DOM INITIALIZATION
// ============================================================
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded - initializing app');
    initializeApp();
});

// ============================================================
// MAIN APPLICATION INITIALIZATION
// ============================================================
function initializeApp() {
    console.log('Initializing application...');
    
    // Initialize time display
    updateTime();
    setInterval(updateTime, 60000);
    
    // Populate production feed with initial jobs
    populateProductionFeed();
    
    // Initialize all machine elements
    initializeMachineElements();
    
    // Initialize zoom controls
    initializeZoomControls();
    
    // Setup event listeners
    setupEventListeners();
    
    // Update machine statuses
    updateAllMachineStatuses();
    
    // Initialize now indicators
    initializeNowIndicators();
    startJobTimeUpdates();
    startDynamicTimeUpdates();
    updateAllJobColors();
    updateStatistics();
    
    // Apply initial zoom
    setTimeout(() => {
        applySmartZoom();
    }, 200);
    
    // Start timeline scrolling based on time
    startTimelineScrolling();
        // ✅ ADD THIS LINE:
        setupModalEventListeners();
    
    console.log('Application initialized successfully');
}

// ============================================================
// TIMELINE SCROLLING - moves jobs left based on current time
// ============================================================
let autoScrollEnabled = true;

function startTimelineScrolling() {
    if (timelineScrollInterval) {
        clearInterval(timelineScrollInterval);
    }
    // Update scroll position every 5 seconds
    timelineScrollInterval = setInterval(updateAllTimelineScrollPositions, 5000);
    // Also update on initial load
    setTimeout(updateAllTimelineScrollPositions, 1000);
    
    document.querySelectorAll('.timeline-container').forEach(container => {
        container.addEventListener('scroll', function() {
            if (autoScrollEnabled) {
                autoScrollEnabled = false;
                clearTimeout(window.autoScrollTimeout);
                window.autoScrollTimeout = setTimeout(() => {
                    autoScrollEnabled = true;
                    // Remove or comment out this line
                    // showAutoScrollIndicator('Auto-scroll resumed');
                }, 30000);
                // Remove or comment out this line
                // showAutoScrollIndicator('Auto-scroll paused (manual scroll detected)');
            }
        }, { passive: true });
    });
}

function updateAllTimelineScrollPositions() {
    document.querySelectorAll('.timeline').forEach(timeline => {
        updateTimelineScrollPosition(timeline);
    });
}

// ============================================================
// UPDATE ALL TIMELINE SCROLL POSITIONS - enhanced with ruler sync
// ============================================================

// Replace the existing updateTimelineScrollPosition function
function updateTimelineScrollPosition(timeline) {
    const container = timeline.closest('.timeline-container');
    if (!container) return;
    
    // If auto-scroll is disabled, don't auto-scroll
    if (!autoScrollEnabled) return;
    
    const now = new Date().getTime();
    const jobs = timeline.querySelectorAll('.job:not(.job-printed)');
    
    if (jobs.length === 0) {
        container.scrollLeft = 0;
        return;
    }
    
    // Find the first job (current job)
    const firstJob = jobs[0];
    if (!firstJob) return;
    
    const firstJobId = firstJob.getAttribute('data-job-id');
    if (!jobSchedule[firstJobId]) return;
    
    const firstStartTime = jobSchedule[firstJobId].startTime;
    const lastJob = jobs[jobs.length - 1];
    const lastJobId = lastJob.getAttribute('data-job-id');
    const lastEndTime = jobSchedule[lastJobId]?.endTime || firstStartTime + 3600000;
    
    const totalDuration = lastEndTime - firstStartTime;
    const elapsed = now - firstStartTime;
    
    // Calculate how much of the timeline has passed (as percentage)
    let progressPercentage = Math.min(95, Math.max(0, (elapsed / totalDuration) * 100));
    
    // Get container width
    const containerWidth = container.clientWidth;
    
    // Get total timeline width (sum of all job widths + gaps + padding)
    let totalTimelineWidth = 0;
    const allJobs = timeline.querySelectorAll('.job');
    allJobs.forEach(job => {
        totalTimelineWidth += job.offsetWidth + 6;
    });
    // Add padding
    totalTimelineWidth += 24;
    
    if (totalTimelineWidth <= containerWidth) {
        container.scrollLeft = 0;
        return;
    }
    
    const scrollableWidth = totalTimelineWidth - containerWidth;
    const targetScrollPosition = (progressPercentage / 100) * scrollableWidth - containerWidth * 0.15;
    const clampedScroll = Math.max(0, Math.min(scrollableWidth, targetScrollPosition));
    
    const currentScroll = container.scrollLeft;
    const scrollDiff = Math.abs(currentScroll - clampedScroll);
    
    // Only auto-scroll if the user hasn't manually scrolled away
    if (scrollDiff > containerWidth * 0.3) {
        return;
    }
    
    container.scrollTo({
        left: clampedScroll,
        behavior: 'smooth'
    });
}

function showAutoScrollIndicator(message) {
    let indicator = document.querySelector('.auto-scroll-indicator');
    if (!indicator) {
        indicator = document.createElement('div');
        indicator.className = 'auto-scroll-indicator';
        document.body.appendChild(indicator);
    }
    
    indicator.textContent = message;
    indicator.classList.add('visible');
    
    clearTimeout(indicator._timeout);
    indicator._timeout = setTimeout(() => {
        indicator.classList.remove('visible');
    }, 2000);
}

// ============================================================
// AUTO-SCROLL TOGGLE BUTTON
// ============================================================
function setupAutoScrollToggle() {
    const toggleBtn = document.createElement('button');
    toggleBtn.className = 'btn btn-auto-scroll';
    toggleBtn.id = 'toggle-auto-scroll';
    toggleBtn.innerHTML = '<i class="fas fa-play"></i> Auto-Scroll ON';
    
    // Add to zoom controls area
    const zoomControls = document.querySelector('.zoom-controls');
    if (zoomControls) {
        zoomControls.appendChild(toggleBtn);
    }
    
    toggleBtn.addEventListener('click', function() {
        autoScrollEnabled = !autoScrollEnabled;
        if (autoScrollEnabled) {
            this.innerHTML = '<i class="fas fa-play"></i> Auto-Scroll ON';
            this.classList.remove('btn-auto-scroll-off');
            showAutoScrollIndicator('Auto-scroll enabled');
            // Force an update
            setTimeout(updateAllTimelineScrollPositions, 100);
        } else {
            this.innerHTML = '<i class="fas fa-pause"></i> Auto-Scroll OFF';
            this.classList.add('btn-auto-scroll-off');
            showAutoScrollIndicator('Auto-scroll disabled');
        }
    });
}

// ============================================================
// STATISTICS FUNCTIONS
// ============================================================
function updateStatistics() {
    const allFeedItems = document.querySelectorAll('.feed-job');
    // Count visible items - those without the 'filter-hidden' class
    const visibleFeedItems = document.querySelectorAll('.feed-job:not(.filter-hidden)');
    const timelineJobs = document.querySelectorAll('.job:not(.job-printed)').length;
    
    const plannedJobsElement = document.querySelector('.stat-card:nth-child(1) .stat-value');
    const pendingJobsElement = document.querySelector('.stat-card:nth-child(2) .stat-value');
    
    if (plannedJobsElement) {
        plannedJobsElement.textContent = timelineJobs;
    }
    
    if (pendingJobsElement) {
        // Show ONLY visible (filtered) jobs in the production feed
        // If no filters are active, this should equal allFeedItems.length
        pendingJobsElement.textContent = visibleFeedItems.length;
    }
    
    // Update feed header counters
    const feedCountElement = document.querySelector('.feed-count');
    if (feedCountElement) {
        feedCountElement.textContent = `${allFeedItems.length} jobs`;
    }
    
    const visibleCountElement = document.querySelector('.feed-visible-count');
    if (visibleCountElement) {
        const visibleCount = visibleFeedItems.length;
        const totalCount = allFeedItems.length;
        if (visibleCount === totalCount) {
            visibleCountElement.textContent = `${visibleCount} shown`;
            visibleCountElement.className = 'feed-visible-count';
        } else {
            visibleCountElement.textContent = `${visibleCount} shown (${totalCount} total)`;
            visibleCountElement.className = 'feed-visible-count filtered';
        }
    }
}

function calculatePlannedJobs() {
    let totalPlannedJobs = 0;
    document.querySelectorAll('.timeline').forEach(timeline => {
        totalPlannedJobs += timeline.querySelectorAll('.job:not(.job-printed)').length;
    });
    return totalPlannedJobs;
}

function calculatePendingJobs() {
    // Count only visible (filtered) jobs in the production feed
    const visibleFeedItems = document.querySelectorAll('.feed-job:not(.filter-hidden)');
    return visibleFeedItems.length;
}

// ============================================================
// MACHINE ELEMENTS INITIALIZATION
// ============================================================
function initializeMachineElements() {
    console.log('Initializing machine elements...');
    machineIds.forEach(machineId => {
        const timelineId = `timeline-${machineId}`;
        const timeline = document.getElementById(timelineId);
        if (!timeline) {
            console.warn(`Timeline ${timelineId} not found`);
        }
    });
}

// ============================================================
// EVENT LISTENERS
// ============================================================
function setupEventListeners() {
    console.log('Setting up event listeners...');
    
    const addJobBtn = document.getElementById('add-job');
    if (addJobBtn) {
        addJobBtn.addEventListener('click', handleAddJob);
    }
    
    const jobSearch = document.getElementById('job-search');
    if (jobSearch) {
        jobSearch.addEventListener('input', handleSearch);
    }
    
    // Filter button - toggle filter panel
    const filterBtn = document.querySelector('.filter-btn');
    if (filterBtn) {
        filterBtn.addEventListener('click', toggleFilterPanel);
    }
    
    document.addEventListener('keydown', handleKeydown);
    document.addEventListener('click', handleClickOutside);
    
    setupDragAndDrop();
    setupExcelUploads();
    
    // SIMPLIFIED CLICK HANDLERS FOR MODAL
    document.addEventListener('click', function(e) {
        // Check if click is on a feed job
        const feedJob = e.target.closest('.feed-job');
        if (feedJob) {
            // Don't open modal if clicking on interactive elements
            if (e.target.closest('input') || 
                e.target.closest('button') ||
                e.target.closest('.feed-status') ||
                e.target.closest('.feed-pl-status')) {
                return;
            }
            const jobId = feedJob.getAttribute('data-job-id');
            if (jobId) {
                e.stopPropagation();
                console.log('Feed job clicked:', jobId);
                openJobDetailsModal(jobId);
            }
        }
        
        // Check if click is on a timeline job
        const timelineJob = e.target.closest('.job');
        if (timelineJob) {
            // Don't open modal if clicking on inputs or editable fields
            if (e.target.closest('input') || 
                e.target.closest('button') ||
                e.target.closest('select')) {
                return;
            }
            const jobId = timelineJob.getAttribute('data-job-id');
            if (jobId) {
                e.stopPropagation();
                console.log('Timeline job clicked:', jobId);
                openJobDetailsModal(jobId);
            }
        }
    });
}

// ============================================================
// FILTER FUNCTIONALITY
// ============================================================
function toggleFilterPanel() {
    let filterPanel = document.getElementById('filter-panel');
    
    if (filterPanel) {
        filterPanel.classList.toggle('active');
        return;
    }
    
    // Create filter panel
    filterPanel = document.createElement('div');
    filterPanel.id = 'filter-panel';
    filterPanel.className = 'filter-panel';
    
    // Header
    const header = document.createElement('div');
    header.className = 'filter-header';
    header.innerHTML = `
        <span><i class="fas fa-filter"></i> Filter by Status</span>
        <div class="filter-actions">
            <button class="btn-filter-action" id="select-all-statuses">Select All</button>
            <button class="btn-filter-action" id="clear-all-statuses">Clear All</button>
            <button class="btn-filter-action" id="reset-default-filter">Reset Default</button>
        </div>
    `;
    filterPanel.appendChild(header);
    
    // Info about how filtering works
    const info = document.createElement('div');
    info.className = 'filter-info';
    info.innerHTML = `
        <p style="font-size:12px; color:#6c757d; margin:0 0 10px 0;">
            <i class="fas fa-info-circle"></i> 
            AW and PL filters work independently. A job must match BOTH active filter sets to be shown.
            If no filters are selected in a category, all jobs in that category are shown.
        </p>
    `;
    filterPanel.appendChild(info);
    
    // AW Statuses section
    const awSection = document.createElement('div');
    awSection.className = 'filter-section';
    awSection.innerHTML = `
        <div class="filter-section-title" style="display:flex; justify-content:space-between; align-items:center;">
            <span>AW Status <span style="font-size:11px; color:#6c757d; font-weight:normal;">(Artwork)</span></span>
            <button class="btn-filter-action-small" id="aw-select-all">Select All</button>
            <button class="btn-filter-action-small" id="aw-clear-all">Clear All</button>
        </div>
    `;
    filterPanel.appendChild(awSection);
    
    const awList = document.createElement('div');
    awList.className = 'filter-list';
    
    AW_STATUSES.forEach(status => {
        const item = document.createElement('label');
        item.className = 'filter-item';
        const color = statusColorMap[status] || '#6c757d';
        const isChecked = filterStatuses.has(status);
        
        item.innerHTML = `
            <input type="checkbox" value="${status}" ${isChecked ? 'checked' : ''} data-type="aw">
            <span class="filter-color" style="background-color:${color}"></span>
            <span class="filter-label">${statusDisplayMap[status] || status}</span>
            <span class="filter-count" id="count-${status.replace(/\s/g, '-')}">0</span>
        `;
        awList.appendChild(item);
        
        const checkbox = item.querySelector('input');
        checkbox.addEventListener('change', function(e) {
            e.stopPropagation();
            if (this.checked) {
                filterStatuses.add(status);
            } else {
                filterStatuses.delete(status);
            }
            applyFilter();
            updateStatistics();
        });
    });
    
    filterPanel.appendChild(awList);
    
    // Divider
    const divider = document.createElement('hr');
    divider.style.cssText = 'margin: 10px 0; border: none; border-top: 1px solid #e9ecef;';
    filterPanel.appendChild(divider);
    
// PL Statuses section
const plSection = document.createElement('div');
plSection.className = 'filter-section';
plSection.innerHTML = `
    <div class="filter-section-title" style="display:flex; justify-content:space-between; align-items:center;">
        <span>PL Status <span style="font-size:11px; color:#6c757d; font-weight:normal;">(Planning)</span></span>
        <button class="btn-filter-action-small" id="pl-select-all">Select All</button>
        <button class="btn-filter-action-small" id="pl-clear-all">Clear All</button>
    </div>
`;
filterPanel.appendChild(plSection);

const plList = document.createElement('div');
plList.className = 'filter-list';

PL_STATUSES.forEach(status => {
    const item = document.createElement('label');
    item.className = 'filter-item';
    const color = statusColorMap[status] || '#6c757d';
    const isChecked = filterStatuses.has(status);
    
    // Use the display name for the label
    const displayName = statusDisplayMap[status] || status;
    
    // Create unique ID for the count badge
    const countId = `count-${status.replace(/\s/g, '-')}`;
    
    item.innerHTML = `
        <input type="checkbox" value="${status}" ${isChecked ? 'checked' : ''} data-type="pl">
        <span class="filter-color" style="background-color:${color}"></span>
        <span class="filter-label">${displayName}</span>
        <span class="filter-count" id="${countId}">0</span>
    `;
    plList.appendChild(item);
    
    const checkbox = item.querySelector('input');
    checkbox.addEventListener('change', function(e) {
        e.stopPropagation();
        if (this.checked) {
            filterStatuses.add(status);
        } else {
            filterStatuses.delete(status);
        }
        applyFilter();
        updateStatistics();
    });
});

filterPanel.appendChild(plList);
    
    // Add to DOM after the feed controls
    const feedControls = document.querySelector('.feed-controls');
    if (feedControls) {
        feedControls.parentNode.insertBefore(filterPanel, feedControls.nextSibling);
    }
    
    // AW Select All button
    document.getElementById('aw-select-all').addEventListener('click', function(e) {
        e.stopPropagation();
        AW_STATUSES.forEach(status => {
            filterStatuses.add(status);
        });
        awList.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = true);
        applyFilter();
        updateStatistics();
    });
    
    // AW Clear All button
    document.getElementById('aw-clear-all').addEventListener('click', function(e) {
        e.stopPropagation();
        AW_STATUSES.forEach(status => {
            filterStatuses.delete(status);
        });
        awList.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false);
        applyFilter();
        updateStatistics();
    });
    
    // PL Select All button
    document.getElementById('pl-select-all').addEventListener('click', function(e) {
        e.stopPropagation();
        PL_STATUSES.forEach(status => {
            filterStatuses.add(status);
        });
        plList.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = true);
        applyFilter();
        updateStatistics();
    });
    
    // PL Clear All button
    document.getElementById('pl-clear-all').addEventListener('click', function(e) {
        e.stopPropagation();
        PL_STATUSES.forEach(status => {
            filterStatuses.delete(status);
        });
        plList.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false);
        applyFilter();
        updateStatistics();
    });
    
    // Reset Default button
document.getElementById('reset-default-filter').addEventListener('click', function(e) {
    e.stopPropagation();
    // Reset to default: AW: all except Missing Data, Unknown, Deleted, On Hold; 
    // PL: Planned and Unprinted only (Complete, PL-Deleted, PL-Hold unchecked)
    filterStatuses = new Set();
    
    AW_STATUSES.forEach(status => {
        if (status !== 'Missing Data' && status !== 'Unknown' && status !== 'Deleted' && status !== 'On Hold') {
            filterStatuses.add(status);
        }
    });
    
    PL_STATUSES.forEach(status => {
        if (status === 'Planned' || status === 'Unprinted') {
            filterStatuses.add(status);
        }
        // Complete, PL-Deleted, PL-Hold are unchecked by default
    });
    
    // Update all checkboxes
    filterPanel.querySelectorAll('input[type="checkbox"]').forEach(cb => {
        cb.checked = filterStatuses.has(cb.value);
    });
    
    applyFilter();
    updateStatistics();
});
    
    // Select All button (global)
    document.getElementById('select-all-statuses').addEventListener('click', function(e) {
        e.stopPropagation();
        ALL_STATUSES.forEach(status => {
            filterStatuses.add(status);
        });
        filterPanel.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = true);
        applyFilter();
        updateStatistics();
    });
    
    // Clear All button (global)
    document.getElementById('clear-all-statuses').addEventListener('click', function(e) {
        e.stopPropagation();
        filterStatuses = new Set();
        filterPanel.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false);
        applyFilter();
        updateStatistics();
    });
    
    // Force initial count update
    setTimeout(() => {
        updateFilterCounts();
    }, 100);
    
    filterPanel.classList.add('active');
}

function applyFilter() {
    const feedItems = document.querySelectorAll('.feed-job');
    let visibleCount = 0;
    
    // Get AW filter statuses
    const awFilterStatuses = new Set();
    const plFilterStatuses = new Set();
    
    filterStatuses.forEach(status => {
        if (AW_STATUSES.includes(status)) {
            awFilterStatuses.add(status);
        }
        if (PL_STATUSES.includes(status)) {
            plFilterStatuses.add(status);
        }
    });
    
    const hasAWFilter = awFilterStatuses.size > 0;
    const hasPLFilter = plFilterStatuses.size > 0;
    
    // If no filters are active in either category, show all jobs
    const showAll = !hasAWFilter && !hasPLFilter;
    
    feedItems.forEach(item => {
        if (showAll) {
            // No filters active - show everything
            item.classList.remove('filter-hidden');
            visibleCount++;
            return;
        }
        
        // Get AW status from data attribute
        const statusElement = item.querySelector('.feed-status');
        let awStatus = '';
        if (statusElement) {
            awStatus = statusElement.getAttribute('data-raw-status') || '';
            if (!awStatus) {
                const text = statusElement.textContent.trim();
                const match = text.match(/AW:\s*(.+)/);
                if (match) {
                    awStatus = match[1].trim();
                } else {
                    awStatus = text.trim();
                }
            }
        }
        
        // Get PL status from data attribute
        const plStatusElement = item.querySelector('.feed-pl-status');
        let plStatus = '';
        if (plStatusElement) {
            plStatus = plStatusElement.getAttribute('data-raw-pl-status') || '';
            if (!plStatus) {
                const plText = plStatusElement.textContent.trim();
                const match = plText.match(/PL:\s*(.+)/);
                if (match) {
                    plStatus = match[1].trim();
                }
            }
        }
        
        // Find matching AW status - handle blank/empty
        let awMatched = null;
        if (awStatus) {
            awMatched = AW_STATUSES.find(s => statusDisplayMap[s] === awStatus || s === awStatus);
            
            // If not found in AW_STATUSES, check if it's a PL status
            if (!awMatched) {
                const isPLStatus = PL_STATUSES.some(s => statusDisplayMap[s] === awStatus || s === awStatus);
                if (isPLStatus || awStatus === '' || awStatus === 'Pending') {
                    awMatched = 'Unknown';
                } else {
                    awMatched = 'Unknown';
                }
            }
        } else {
            // Blank/empty AW status - treat as "Unknown"
            awMatched = 'Unknown';
        }
        
        // Find matching PL status - handle PL-specific mappings
        let plMatched = null;
        if (plStatus) {
            // Map display names to internal PL statuses
            if (plStatus === 'Deleted') {
                plMatched = 'PL-Deleted';
            } else if (plStatus === 'Hold') {
                plMatched = 'PL-Hold';
            } else {
                // Try exact match in PL_STATUSES
                plMatched = PL_STATUSES.find(s => s === plStatus);
                // Also check if it's a display name that matches a PL status
                if (!plMatched) {
                    for (const [key, value] of Object.entries(statusDisplayMap)) {
                        if (value === plStatus && PL_STATUSES.includes(key)) {
                            plMatched = key;
                            break;
                        }
                    }
                }
            }
        }
        
        // If no PL status matched, treat as visible for PL filtering
        if (!plMatched) {
            plMatched = 'Unprinted';
        }
        
        // Check AW visibility - if no AW filters are selected, all AW statuses are visible
        let awVisible = true;
        if (hasAWFilter) {
            awVisible = awFilterStatuses.has(awMatched);
        }
        
        // Check PL visibility - if no PL filters are selected, all PL statuses are visible
        let plVisible = true;
        if (hasPLFilter) {
            plVisible = plFilterStatuses.has(plMatched);
        }
        
        // Job is visible if AW is visible AND PL is visible
        if (awVisible && plVisible) {
            item.classList.remove('filter-hidden');
            visibleCount++;
        } else {
            item.classList.add('filter-hidden');
        }
    });
    
    // Update the visible count in the feed header
    const visibleJobsElement = document.querySelector('.feed-header .feed-visible-count');
    if (visibleJobsElement) {
        const totalCount = feedItems.length;
        if (visibleCount === totalCount) {
            visibleJobsElement.textContent = `${visibleCount} shown`;
            visibleJobsElement.className = 'feed-visible-count';
        } else {
            visibleJobsElement.textContent = `${visibleCount} shown (${totalCount} total)`;
            visibleJobsElement.className = 'feed-visible-count filtered';
        }
    }
    
    updateFilterCounts();  // Update counters (shows total counts)
    updateStatistics();    // Update stats with filtered counts
}

function updateFilterCounts() {
    // Count ALL jobs in the production feed (including hidden ones)
    const allFeedItems = document.querySelectorAll('.feed-job');
    const counts = {};
    
    // Initialize counts for all statuses
    ALL_STATUSES.forEach(s => counts[s] = 0);
    
    allFeedItems.forEach(item => {
        // Get AW status from data attribute
        const statusElement = item.querySelector('.feed-status');
        let awStatus = '';
        if (statusElement) {
            awStatus = statusElement.getAttribute('data-raw-status') || '';
            if (!awStatus) {
                const text = statusElement.textContent.trim();
                const match = text.match(/AW:\s*(.+)/);
                if (match) {
                    awStatus = match[1].trim();
                } else {
                    awStatus = text.trim();
                }
            }
        }
        
        // Get PL status from data attribute
        const plStatusElement = item.querySelector('.feed-pl-status');
        let plStatus = '';
        if (plStatusElement) {
            plStatus = plStatusElement.getAttribute('data-raw-pl-status') || '';
            if (!plStatus) {
                const plText = plStatusElement.textContent.trim();
                const match = plText.match(/PL:\s*(.+)/);
                if (match) {
                    plStatus = match[1].trim();
                }
            }
        }
        
        // Get the job ID to check raw AW status
        const jobId = item.getAttribute('data-job-id');
        const jobData = jobDatabase[jobId];
        
        // Count AW status - use the raw status from the file
        let awMatched = null;
        let rawAWStatus = awStatus;
        
        // If we have job data with rawAWStatus, use that for accurate counting
        if (jobData && jobData.rawAWStatus !== undefined) {
            rawAWStatus = jobData.rawAWStatus;
        }
        
        // Check if this is a valid AW status from the file
        if (rawAWStatus) {
            // Only count as "Missing Data" if the actual status from the file is "Missing Data"
            if (rawAWStatus === 'Missing Data') {
                awMatched = 'Missing Data';
            } 
            // Check if it's a known AW status
            else if (AW_STATUSES.includes(rawAWStatus)) {
                awMatched = rawAWStatus;
            }
            // Check if it's a display name that matches an AW status
            else {
                awMatched = AW_STATUSES.find(s => statusDisplayMap[s] === rawAWStatus);
            }
        }
        
        // If no AW status matched, it's "Unknown" (not "Missing Data")
        if (!awMatched) {
            // Check if the status is empty/blank
            if (!rawAWStatus || rawAWStatus === '' || rawAWStatus === 'Pending' || rawAWStatus === 'Unknown') {
                awMatched = 'Unknown';
            } else {
                // Check if it's a PL status (Complete, Planned, Unprinted, etc.)
                const isPLStatus = PL_STATUSES.some(s => statusDisplayMap[s] === rawAWStatus || s === rawAWStatus);
                if (isPLStatus) {
                    awMatched = 'Unknown';
                } else {
                    // Any other unknown status
                    awMatched = 'Unknown';
                }
            }
        }
        
        if (awMatched) {
            counts[awMatched] = (counts[awMatched] || 0) + 1;
        }
        
        // Count PL status - map to PL-specific statuses if needed
        if (plStatus) {
            let plMatched = null;
            
            // Map display names to internal PL statuses
            if (plStatus === 'Deleted') {
                plMatched = 'PL-Deleted';
            } else if (plStatus === 'Hold') {
                plMatched = 'PL-Hold';
            } else {
                // Check if it's a PL status value (like 'Complete', 'Planned', 'Unprinted')
                plMatched = PL_STATUSES.find(s => s === plStatus);
                // Also check if it's a display name that matches a PL status
                if (!plMatched) {
                    for (const [key, value] of Object.entries(statusDisplayMap)) {
                        if (value === plStatus && PL_STATUSES.includes(key)) {
                            plMatched = key;
                            break;
                        }
                    }
                }
            }
            
            if (plMatched) {
                counts[plMatched] = (counts[plMatched] || 0) + 1;
            }
        }
    });
    
    // Update the DOM elements for ALL statuses
    ALL_STATUSES.forEach(status => {
        const badgeId = `count-${status.replace(/\s/g, '-')}`;
        const badge = document.getElementById(badgeId);
        if (badge) {
            badge.textContent = counts[status] || 0;
        }
    });
    
    // Also update the total job count in the feed header
    const totalJobsElement = document.querySelector('.feed-header .feed-count');
    if (totalJobsElement) {
        totalJobsElement.textContent = `${allFeedItems.length} jobs`;
    }
}

// ============================================================
// DRAG AND DROP
// ============================================================
function setupDragAndDrop() {
    console.log('Setting up drag and drop...');
    
    document.addEventListener('dragstart', function(e) {
        const target = e.target.closest('.feed-job, .job');
        if (target) {
            draggedElement = target;
            target.classList.add('job-dragging');
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', target.getAttribute('data-job-id'));
        }
    });
    
    document.addEventListener('dragend', function(e) {
        if (draggedElement) {
            draggedElement.classList.remove('job-dragging');
            if (dragOverElement) {
                dragOverElement.classList.remove('drag-over-before', 'drag-over-after');
                dragOverElement = null;
            }
            document.querySelectorAll('.job').forEach(job => {
                job.classList.remove('drag-over-before', 'drag-over-after');
            });
            draggedElement = null;
            updateStatistics();
        }
    });
    
    document.querySelectorAll('.timeline').forEach(timeline => {
        timeline.addEventListener('dragover', function(e) {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            
            if (draggedElement && draggedElement.classList.contains('job') && !draggedElement.classList.contains('job-printed')) {
                const afterElement = getDragAfterElement(this, e.clientX);
                const jobs = Array.from(this.querySelectorAll('.job:not(.job-dragging):not(.job-printed)'));
                
                jobs.forEach(job => job.classList.remove('drag-over-before', 'drag-over-after'));
                
                if (!afterElement) {
                    const lastJob = jobs[jobs.length - 1];
                    if (lastJob) {
                        lastJob.classList.add('drag-over-after');
                        dragOverElement = lastJob;
                    }
                } else {
                    afterElement.classList.add('drag-over-before');
                    dragOverElement = afterElement;
                }
            }
        });
        
        timeline.addEventListener('dragleave', function(e) {
            if (!this.contains(e.relatedTarget)) {
                this.querySelectorAll('.job').forEach(job => {
                    job.classList.remove('drag-over-before', 'drag-over-after');
                });
                dragOverElement = null;
            }
        });
        
        timeline.addEventListener('drop', function(e) {
            e.preventDefault();
            
            if (draggedElement) {
                const jobId = draggedElement.getAttribute('data-job-id');
                
                if (draggedElement.classList.contains('feed-job')) {
                    // Check if already on timeline before adding
                    const existingJob = document.querySelector(`.job[data-job-id="${jobId}"]`);
                    if (existingJob) {
                        const jobName = jobDatabase[jobId]?.name || jobId;
                        showNotification(`⚠️ "${jobName}" is already on the timeline!`, 'warning');
                        // Reset drag state
                        this.querySelectorAll('.job').forEach(job => {
                            job.classList.remove('drag-over-before', 'drag-over-after');
                        });
                        dragOverElement = null;
                        return;
                    }
                    handleFeedToTimeline(jobId, this, e);
                } else if (draggedElement.classList.contains('job') && !draggedElement.classList.contains('job-printed')) {
                    handleJobReorder(jobId, this, e);
                }
                
                this.querySelectorAll('.job').forEach(job => {
                    job.classList.remove('drag-over-before', 'drag-over-after');
                });
                dragOverElement = null;
                
                updateAllJobColors();
                updateStatistics();
                applySmartZoom();
                setTimeout(() => updateAllTimelineScrollPositions(), 300);
            }
        });
    });
    
    const productionFeed = document.getElementById('production-feed-list');
    if (productionFeed) {
        productionFeed.addEventListener('dragover', function(e) {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
        });
        
        productionFeed.addEventListener('drop', function(e) {
            e.preventDefault();
            if (draggedElement && draggedElement.classList.contains('job') && !draggedElement.classList.contains('job-printed')) {
                returnJobToFeed(draggedElement);
                updateAllJobColors();
                updateStatistics();
                applySmartZoom();
                setTimeout(() => updateAllTimelineScrollPositions(), 300);
            }
        });
    }
}
function checkJobOnTimeline(jobId) {
    const existingJob = document.querySelector(`.job[data-job-id="${jobId}"]`);
    return !!existingJob;
}

// Add this to the drag start event to provide visual feedback
// Update the dragstart event listener:
document.addEventListener('dragstart', function(e) {
    const target = e.target.closest('.feed-job, .job');
    if (target) {
        const jobId = target.getAttribute('data-job-id');
        
        // If dragging from feed, check if already on timeline
        if (target.classList.contains('feed-job')) {
            const isOnTimeline = checkJobOnTimeline(jobId);
            if (isOnTimeline) {
                target.classList.add('job-already-on-timeline');
                // Show a tooltip or indicator
                const jobName = jobDatabase[jobId]?.name || jobId;
                target.setAttribute('title', `⚠️ "${jobName}" is already on the timeline!`);
            } else {
                target.classList.remove('job-already-on-timeline');
                target.removeAttribute('title');
            }
        }
        
        draggedElement = target;
        target.classList.add('job-dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', jobId);
    }
});

function getDragAfterElement(container, x) {
    const draggableElements = [...container.querySelectorAll('.job:not(.job-dragging):not(.job-printed)')];
    return draggableElements.reduce((closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = x - box.left - box.width / 2;
        if (offset < 0 && offset > closest.offset) {
            return { offset: offset, element: child };
        } else {
            return closest;
        }
    }, { offset: Number.NEGATIVE_INFINITY }).element;
}

function handleFeedToTimeline(jobId, timeline, e) {
    // Check if the job is already on any timeline
    const existingJobOnTimeline = document.querySelector(`.job[data-job-id="${jobId}"]`);
    if (existingJobOnTimeline) {
        showNotification(`⚠️ Job "${jobDatabase[jobId]?.name || jobId}" is already on the timeline!`, 'warning');
        return;
    }
    
    // Check if the job exists in jobDatabase
    if (!jobDatabase[jobId]) {
        showNotification(`❌ Job "${jobId}" not found in database!`, 'error');
        return;
    }
    
    // UPDATE PL STATUS TO "Planned" BEFORE ADDING TO TIMELINE
    // This ensures the job is properly tracked in the filter
    updateJobPLStatus(jobId, 'Planned');
    
    const jobs = timeline.querySelectorAll('.job:not(.job-printed)');
    let newStartTime;
    
    if (jobs.length > 0) {
        const afterElement = getDragAfterElement(timeline, e.clientX);
        if (afterElement) {
            const insertIndex = Array.from(timeline.children).indexOf(afterElement);
            const prevJob = insertIndex > 0 ? timeline.children[insertIndex - 1] : null;
            if (prevJob && prevJob.classList.contains('job') && !prevJob.classList.contains('job-printed')) {
                const prevJobId = prevJob.getAttribute('data-job-id');
                newStartTime = jobSchedule[prevJobId].endTime;
            } else {
                // No extra 30 minutes - start immediately
                newStartTime = new Date().getTime();
            }
        } else {
            const lastJobId = jobs[jobs.length - 1].getAttribute('data-job-id');
            newStartTime = jobSchedule[lastJobId].endTime;
        }
    } else {
        // No extra 30 minutes - start immediately
        newStartTime = new Date().getTime();
    }
    
    addJobToTimelineWithSchedule(jobId, timeline.id, newStartTime);
    rescheduleTimelineJobs(timeline.id);
    updateAllJobColors();
    updateStatistics();
    applySmartZoom();
    
    // Show success notification
    const jobName = jobDatabase[jobId]?.name || jobId;
    showNotification(`✅ "${jobName}" added to timeline (PL: Planned)`, 'success');
    
    setTimeout(() => updateAllTimelineScrollPositions(), 300);
}
// ============================================================
// UPDATE PL STATUS FUNCTION
// ============================================================
function updateJobPLStatus(jobId, newPLStatus) {
    if (!jobDatabase[jobId]) return false;
    
    // Validate PL status - use internal values
    const validPLStatuses = ['Planned', 'Unprinted', 'Complete', 'PL-Deleted', 'PL-Hold'];
    // Also accept user-friendly names and map them
    const statusMap = {
        'Planned': 'Planned',
        'Unprinted': 'Unprinted',
        'Complete': 'Complete',
        'Deleted': 'PL-Deleted',
        'Hold': 'PL-Hold'
    };
    
    // Map user-friendly names to internal values
    const mappedStatus = statusMap[newPLStatus] || newPLStatus;
    
    if (!validPLStatuses.includes(mappedStatus)) {
        console.warn(`Invalid PL status: ${newPLStatus}. Using 'Unprinted' as fallback.`);
        const finalStatus = 'Unprinted';
        return updateJobPLStatus(jobId, finalStatus);
    }
    
    const finalStatus = mappedStatus;
    
    // Update in jobDatabase
    jobDatabase[jobId].planningStatus = finalStatus;
    
    // Update in plDatabase if exists
    if (plDatabase[jobId]) {
        plDatabase[jobId].planningStatus = finalStatus;
    }
    
    // Update the feed item
    const feedItem = document.querySelector(`.feed-job[data-job-id="${jobId}"]`);
    if (feedItem) {
        const plStatusElement = feedItem.querySelector('.feed-pl-status');
        if (plStatusElement) {
            // Get the display name for the status
            const displayName = statusDisplayMap[finalStatus] || finalStatus;
            const plStatusColor = statusColorMap[finalStatus] || '#6c757d';
            plStatusElement.setAttribute('data-raw-pl-status', finalStatus);
            plStatusElement.textContent = `PL: ${displayName}`;
            plStatusElement.style.backgroundColor = `${plStatusColor}20`;
            plStatusElement.style.color = plStatusColor;
            plStatusElement.style.border = `1px solid ${plStatusColor}40`;
        }
    }
    
    // Update the job element on timeline if it exists
    const jobElement = document.querySelector(`.job[data-job-id="${jobId}"]`);
    if (jobElement) {
        // The job status badge shows AW status, so we don't update it here
        // But we could add a PL indicator if needed
    }
    
    // Re-apply filter to reflect changes
    applyFilter();
    updateStatistics();
    
    console.log(`Updated PL status for ${jobId} to: ${finalStatus} (display: ${statusDisplayMap[finalStatus] || finalStatus})`);
    return true;
}

function handleJobReorder(jobId, targetTimeline, e) {
    const oldTimeline = draggedElement.parentElement;
    draggedElement.remove();
    
    const afterElement = getDragAfterElement(targetTimeline, e.clientX);
    if (afterElement) {
        targetTimeline.insertBefore(draggedElement, afterElement);
    } else {
        targetTimeline.appendChild(draggedElement);
    }
    
    if (jobSchedule[jobId]) {
        jobSchedule[jobId].timelineId = targetTimeline.id;
    }
    
    rescheduleTimelineJobs(oldTimeline.id);
    rescheduleTimelineJobs(targetTimeline.id);
    
    scaleTimeline(oldTimeline.id);
    scaleTimeline(targetTimeline.id);
    updateMachineStatus(oldTimeline.closest('.machine'));
    updateMachineStatus(targetTimeline.closest('.machine'));
    updateAllJobTimes();
    updateAllJobColors();
    updateStatistics();
    applySmartZoom();
    setTimeout(() => updateAllTimelineScrollPositions(), 300);
}

// ============================================================
// TIMELINE SCHEDULING
// ============================================================
function rescheduleTimelineJobs(timelineId) {
    const timeline = document.getElementById(timelineId);
    if (!timeline) return;
    
    const jobs = timeline.querySelectorAll('.job:not(.job-printed)');
    if (jobs.length === 0) return;
    
    // Start from current time (no extra 30 minutes)
    let currentTime = new Date().getTime();
    
    const printedJobs = timeline.querySelectorAll('.job.job-printed');
    if (printedJobs.length > 0) {
        const lastPrinted = printedJobs[printedJobs.length - 1];
        const lastPrintedId = lastPrinted.getAttribute('data-job-id');
        if (jobSchedule[lastPrintedId]) {
            currentTime = Math.max(currentTime, jobSchedule[lastPrintedId].endTime);
        }
    }
    
    jobs.forEach(job => {
        const jobId = job.getAttribute('data-job-id');
        const jobData = jobDatabase[jobId];
        if (!jobData) return;
        const duration = calculateJobDuration(jobData, jobId) * 60000;
        
        jobSchedule[jobId] = {
            startTime: currentTime,
            endTime: currentTime + duration,
            timelineId: timelineId,
            isPrinted: false
        };
        
        currentTime += duration;
    });
}

function calculateJobDuration(jobData, jobId = null) {
    let speed = machineConfig.speed;
    if (jobId && jobSpeeds[jobId]) {
        speed = jobSpeeds[jobId];
    }
    const printingTime = jobData.quantity / speed;
    // Round to 2 decimal places to avoid floating point issues
    return Math.round((jobData.setup + printingTime) * 100) / 100;
}

// ============================================================
// JOB UPDATE FUNCTIONS - with PL sync
// ============================================================
function updateJobSetup(jobId, newSetup) {
    const setup = parseFloat(newSetup);
    if (isNaN(setup) || setup < 0) return false;
    
    if (jobDatabase[jobId]) {
        jobDatabase[jobId].setup = setup;
        // Update PL data if exists
        if (plDatabase[jobId]) {
            plDatabase[jobId].setupTime = setup;
            plDatabase[jobId].plannedSetup = setup;
        }
        const jobElement = document.querySelector(`.job[data-job-id="${jobId}"]`);
        if (jobElement) {
            const setupElement = jobElement.querySelector('.job-setup');
            if (setupElement) setupElement.textContent = `Setup: ${setup}m`;
            updateJobCardDisplay(jobId);
        }
        
        const timeline = jobElement ? jobElement.parentElement : null;
        if (timeline && !jobElement.classList.contains('job-printed')) {
            rescheduleTimelineJobs(timeline.id);
            scaleTimeline(timeline.id);
            updateAllJobTimes();
            updateAllJobColors();
            updateMachineStatus(timeline.closest('.machine'));
            applySmartZoom();
            setTimeout(() => updateAllTimelineScrollPositions(), 300);
        }
        return true;
    }
    return false;
}

function updateJobQuantity(jobId, newQuantity) {
    const quantity = parseFloat(newQuantity);
    if (isNaN(quantity) || quantity < 0) return false;
    
    if (jobDatabase[jobId]) {
        jobDatabase[jobId].quantity = quantity;
        // Update PL data if exists
        if (plDatabase[jobId]) {
            plDatabase[jobId].meters = quantity;
        }
        const jobElement = document.querySelector(`.job[data-job-id="${jobId}"]`);
        if (jobElement) {
            const quantityElement = jobElement.querySelector('.job-quantity');
            if (quantityElement) quantityElement.textContent = `Qty: ${quantity}m`;
            updateJobCardDisplay(jobId);
        }
        
        const timeline = jobElement ? jobElement.parentElement : null;
        if (timeline && !jobElement.classList.contains('job-printed')) {
            rescheduleTimelineJobs(timeline.id);
            scaleTimeline(timeline.id);
            updateAllJobTimes();
            updateAllJobColors();
            updateMachineStatus(timeline.closest('.machine'));
            applySmartZoom();
            setTimeout(() => updateAllTimelineScrollPositions(), 300);
        }
        return true;
    }
    return false;
}

function updateJobSpeed(jobId, newSpeed) {
    const speed = parseFloat(newSpeed);
    if (isNaN(speed) || speed <= 0) return false;
    
    jobSpeeds[jobId] = speed;
    // Update PL data if exists
    if (plDatabase[jobId]) {
        plDatabase[jobId].machineSpeed = speed;
        plDatabase[jobId].plannedSpeed = speed;
        plDatabase[jobId].actualSpeed = speed;
    }
    const jobElement = document.querySelector(`.job[data-job-id="${jobId}"]`);
    if (jobElement) {
        updateJobCardDisplay(jobId);
        
        let speedIndicator = jobElement.querySelector('.job-speed-indicator');
        if (!speedIndicator) {
            speedIndicator = document.createElement('span');
            speedIndicator.className = 'job-speed-indicator';
            const detailsDiv = jobElement.querySelector('.job-details');
            if (detailsDiv) detailsDiv.appendChild(speedIndicator);
            else jobElement.appendChild(speedIndicator);
        }
        speedIndicator.textContent = `⚡ ${speed} m/min`;
        
        const timeline = jobElement.parentElement;
        if (timeline && !jobElement.classList.contains('job-printed')) {
            rescheduleTimelineJobs(timeline.id);
            scaleTimeline(timeline.id);
            updateAllJobTimes();
            updateAllJobColors();
            updateMachineStatus(timeline.closest('.machine'));
            applySmartZoom();
            setTimeout(() => updateAllTimelineScrollPositions(), 300);
        }
    }
    return true;
}

function updateJobStatus(jobId, newStatus) {
    if (jobDatabase[jobId]) {
        jobDatabase[jobId].status = newStatus;
        // Update PL data if exists
        if (plDatabase[jobId]) {
            plDatabase[jobId].planningStatus = newStatus;
        }
        const jobElement = document.querySelector(`.job[data-job-id="${jobId}"]`);
        if (jobElement) {
            const statusBadge = jobElement.querySelector('.job-status-badge');
            if (statusBadge) {
                statusBadge.textContent = statusDisplayMap[newStatus] || newStatus;
                statusBadge.style.color = statusColorMap[newStatus] || '#6c757d';
            }
        }
        // Update feed item
        const feedItem = document.querySelector(`.feed-job[data-job-id="${jobId}"]`);
        if (feedItem) {
            const statusEl = feedItem.querySelector('.feed-status');
            if (statusEl) {
                statusEl.textContent = statusDisplayMap[newStatus] || newStatus;
                statusEl.style.backgroundColor = `${statusColorMap[newStatus] || '#6c757d'}20`;
                statusEl.style.color = statusColorMap[newStatus] || '#6c757d';
                statusEl.style.borderColor = `${statusColorMap[newStatus] || '#6c757d'}40`;
            }
        }
        applyFilter();
        updateStatistics();
        return true;
    }
    return false;
}

function updateJobCardDisplay(jobId) {
    const jobElement = document.querySelector(`.job[data-job-id="${jobId}"]`);
    if (!jobElement) return;
    
    const jobData = jobDatabase[jobId];
    if (!jobData) return;
    
    const currentSpeed = jobSpeeds[jobId] || machineConfig.speed;
    const duration = Math.round(calculateJobDuration(jobData, jobId));
    const printingTime = Math.round(jobData.quantity / currentSpeed);
    
    const durationElement = jobElement.querySelector('.job-duration');
    if (durationElement) durationElement.textContent = `${duration} min`;
    
    const setupElement = jobElement.querySelector('.job-setup');
    if (setupElement) setupElement.textContent = `Setup: ${jobData.setup}m`;
    
    const printElement = jobElement.querySelector('.job-print');
    if (printElement) printElement.textContent = `Print: ${printingTime}m`;
    
    const quantityElement = jobElement.querySelector('.job-quantity');
    if (quantityElement) quantityElement.textContent = `Qty: ${jobData.quantity}m`;
    
    const setupInput = jobElement.querySelector('.job-setup-input');
    if (setupInput) setupInput.value = jobData.setup;
    
    const quantityInput = jobElement.querySelector('.job-quantity-input');
    if (quantityInput) quantityInput.value = jobData.quantity;
    
    const speedInput = jobElement.querySelector('.job-speed-input');
    if (speedInput) speedInput.value = currentSpeed;
}

// ============================================================
// CREATE JOB ELEMENTS
// ============================================================
function createJobElement(jobId, jobData) {
    const job = document.createElement('div');
    job.className = 'job';
    job.setAttribute('data-job-id', jobId);
    job.setAttribute('draggable', 'true');
    
    const currentSpeed = jobSpeeds[jobId] || machineConfig.speed;
    const duration = Math.round(calculateJobDuration(jobData, jobId));
    const printingTime = Math.round(jobData.quantity / currentSpeed);
    // Use AW status for the badge (prepress status) - NOT PL status
    const awStatus = jobData.awStatus || jobData.status || 'Missing Data';
    const statusColor = statusColorMap[awStatus] || '#6c757d';
    const statusDisplay = statusDisplayMap[awStatus] || awStatus || 'Unknown';
    
    // Get job number or generate one
    const jobNumber = jobData.jobNumber || jobId.replace('job-', 'JOB-').padEnd(8, '0');
    
    job.innerHTML = `
        <div class="job-name">
            <span class="job-number-badge">${jobNumber}</span>
            ${jobData.name}
        </div>
        <div class="job-details">
            <div class="job-duration">${duration} min</div>
            <div class="job-breakdown">
                <span class="job-status-badge" style="color:${statusColor}">AW: ${statusDisplay}</span>
            </div>
        </div>
        <div class="job-time" id="time-${jobId}">Calculating...</div>
        <div class="job-editable-fields">
            <div class="job-field-group">
                <label>Setup (min):
                    <input type="number" class="job-setup-input" 
                           data-job-id="${jobId}"
                           value="${jobData.setup}" 
                           min="0" step="1"
                           title="Setup time in minutes">
                </label>
            </div>
            <div class="job-field-group">
                <label>Qty (m):
                    <input type="number" class="job-quantity-input" 
                           data-job-id="${jobId}"
                           value="${Math.round(jobData.quantity)}" 
                           min="0" step="1"
                           title="Quantity in meters">
                </label>
            </div>
            <div class="job-field-group">
                <label>Speed (m/min):
                    <input type="number" class="job-speed-input" 
                           data-job-id="${jobId}"
                           value="${currentSpeed}" 
                           min="1" step="1"
                           title="Press speed in meters per minute">
                </label>
            </div>
        </div>
    `;
    // Setup input
    const setupInput = job.querySelector('.job-setup-input');
    if (setupInput) {
        setupInput.addEventListener('change', function(e) {
            e.stopPropagation();
            const jobId = this.getAttribute('data-job-id');
            const newSetup = this.value;
            if (updateJobSetup(jobId, newSetup)) {
                this.classList.add('field-updated');
                setTimeout(() => this.classList.remove('field-updated'), 2000);
            }
        });
        setupInput.addEventListener('click', e => e.stopPropagation());
    }
    
    // Quantity input
    const quantityInput = job.querySelector('.job-quantity-input');
    if (quantityInput) {
        quantityInput.addEventListener('change', function(e) {
            e.stopPropagation();
            const jobId = this.getAttribute('data-job-id');
            const newQuantity = this.value;
            if (updateJobQuantity(jobId, newQuantity)) {
                this.classList.add('field-updated');
                setTimeout(() => this.classList.remove('field-updated'), 2000);
            }
        });
        quantityInput.addEventListener('click', e => e.stopPropagation());
    }
    
    // Speed input
    const speedInput = job.querySelector('.job-speed-input');
    if (speedInput) {
        speedInput.addEventListener('change', function(e) {
            e.stopPropagation();
            const jobId = this.getAttribute('data-job-id');
            const newSpeed = this.value;
            if (updateJobSpeed(jobId, newSpeed)) {
                this.classList.add('field-updated');
                setTimeout(() => this.classList.remove('field-updated'), 2000);
            }
        });
        speedInput.addEventListener('click', e => e.stopPropagation());
    }
    
    job.addEventListener('click', function(e) {
        e.stopPropagation();
        selectJob(this);
    });
    
    return job;
}

// ============================================================
// CREATE FEED JOB ELEMENT - with AW status and PL status
// ============================================================
function createFeedJobElement(jobId, jobData) {
    const feedJob = document.createElement('div');
    feedJob.className = 'feed-job';
    feedJob.setAttribute('data-job-id', jobId);
    feedJob.setAttribute('draggable', 'true');
    
    const duration = calculateJobDuration(jobData, jobId);
    
    // AW status
    let awStatus = jobData.rawAWStatus || jobData.awStatus || jobData.status || 'Missing Data';
    if (awStatus === '' || awStatus === 'Pending') {
        awStatus = 'Unknown';
    }
    
    const statusColor = statusColorMap[awStatus] || '#6c757d';
    const statusDisplay = statusDisplayMap[awStatus] || awStatus || 'Unknown';
    
    // Format the status date - only date, no time
    let statusDateFormatted = '';
    if (jobData.statusDate) {
        const dateObj = new Date(jobData.statusDate);
        if (!isNaN(dateObj.getTime()) && dateObj.getFullYear() > 1900) {
            statusDateFormatted = formatDateOnly(dateObj);
        } else {
            statusDateFormatted = '01/01/1900';
        }
    } else {
        statusDateFormatted = '01/01/1900';
    }
    
    // PL status
    const plStatus = jobData.planningStatus || 'Unprinted';
    const plDisplayStatus = statusDisplayMap[plStatus] || plStatus || 'Unknown';
    const plStatusColor = statusColorMap[plStatus] || '#6c757d';
    
    const jobNumber = jobData.jobNumber || jobId.replace('job-', 'JOB-').padEnd(8, '0');
    
    // Format estimated date - only date, no time
    let estimatedDateFormatted = '';
    let estimatedDisplayText = '';
    if (jobData.estimatedDate) {
        const dateObj = new Date(jobData.estimatedDate);
        if (!isNaN(dateObj.getTime()) && dateObj.getFullYear() > 1900) {
            estimatedDateFormatted = formatDateOnly(dateObj);
            estimatedDisplayText = `Est: ${estimatedDateFormatted}`;
        }
    }
    
    // Check if estimated date should be shown
    const showEstimated = awStatus === '8. Repro: Plate Making' || awStatus === '5. Working on Cromalin';
    
    feedJob.innerHTML = `
        <div class="feed-item-content">
            <span class="feed-job-number">${jobNumber}</span>
            <span class="feed-job-name">${jobData.name || 'Unnamed'}</span>
            <div class="feed-status-wrapper">
                <span class="feed-status" 
                      data-raw-status="${awStatus}"
                      style="background-color:${statusColor}20; color:${statusColor}; border:1px solid ${statusColor}40;">
                    AW: ${statusDisplay} since: ${statusDateFormatted}
                </span>
                ${showEstimated && estimatedDisplayText ? 
                    `<span class="feed-estimated-date" style="color:${statusColor}; background-color:${statusColor}15; border-color:${statusColor}40;">
                        ${estimatedDisplayText}
                    </span>` : ''
                }
            </div>
            <span class="feed-pl-status" 
                  data-raw-pl-status="${plStatus}"
                  style="background-color:${plStatusColor}20; color:${plStatusColor}; border:1px solid ${plStatusColor}40;">
                PL: ${plDisplayStatus}
            </span>
        </div>
    `;
    
    feedJob.addEventListener('click', function(e) {
        e.stopPropagation();
        selectJob(this);
    });
    
    return feedJob;
}

// ============================================================
// FORMAT DATE TIME - "08/03/2026 12:30"
// ============================================================
function formatDateTime(date) {
    if (!date || isNaN(date.getTime())) return '01/01/1900 00:00';
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${day}/${month}/${year} ${hours}:${minutes}`;
}

// ============================================================
// PRODUCTION FEED
// ============================================================
function populateProductionFeed() {
    const productionFeedList = document.getElementById('production-feed-list');
    if (!productionFeedList) return;
    
    productionFeedList.innerHTML = '';
    
    // Sort by status date (most recent first)
    const sortedJobIds = Object.keys(jobDatabase).sort((a, b) => {
        const dateA = jobDatabase[a].statusDate ? new Date(jobDatabase[a].statusDate) : new Date(1900, 0, 1);
        const dateB = jobDatabase[b].statusDate ? new Date(jobDatabase[b].statusDate) : new Date(1900, 0, 1);
        return dateB - dateA;
    });
    
    sortedJobIds.forEach(jobId => {
        const feedJob = createFeedJobElement(jobId, jobDatabase[jobId]);
        productionFeedList.appendChild(feedJob);
    });
    
    applyFilter();
    updateFilterCounts();  // Make sure this is called
    updateStatistics();
}

// ============================================================
// TIMELINE OPERATIONS
// ============================================================
function addJobToTimelineWithSchedule(jobId, timelineId, startTime) {
    const timeline = document.getElementById(timelineId);
    if (!timeline) return;
    
    const jobData = jobDatabase[jobId];
    if (!jobData) return;
    
    const jobElement = createJobElement(jobId, jobData);
    
    const feedJob = document.querySelector(`.feed-job[data-job-id="${jobId}"]`);
    if (feedJob) feedJob.remove();
    
    const duration = calculateJobDuration(jobData, jobId);
    const endTime = startTime + duration * 60000;
    
    jobSchedule[jobId] = {
        startTime: startTime,
        endTime: endTime,
        timelineId: timelineId,
        isPrinted: false
    };
    
    // Insert before printed jobs (at the end)
    const printedJobs = timeline.querySelectorAll('.job.job-printed');
    if (printedJobs.length > 0) {
        timeline.insertBefore(jobElement, printedJobs[0]);
    } else {
        timeline.appendChild(jobElement);
    }
    
    scaleTimeline(timelineId);
    updateMachineStatus(timeline.closest('.machine'));
    updateJobTimeDisplay(jobId);
    updateAllJobColors();
    updateStatistics();
    applySmartZoom();
    setTimeout(() => updateAllTimelineScrollPositions(), 300);
}

function returnJobToFeed(jobElement) {
    const jobId = jobElement.getAttribute('data-job-id');
    const jobData = jobDatabase[jobId];
    if (!jobData) return;
    
    delete jobSpeeds[jobId];
    
    // UPDATE PL STATUS TO "Unprinted" WHEN REMOVED FROM TIMELINE
    updateJobPLStatus(jobId, 'Unprinted');
    
    const feedJob = createFeedJobElement(jobId, jobData);
    const productionFeedList = document.getElementById('production-feed-list');
    
    if (productionFeedList) {
        productionFeedList.appendChild(feedJob);
        const timeline = jobElement.parentElement;
        jobElement.remove();
        delete jobSchedule[jobId];
        scaleTimeline(timeline.id);
        updateMachineStatus(timeline.closest('.machine'));
        applyFilter();
        updateStatistics();
        applySmartZoom();
        
        showNotification(`↩️ "${jobData.name || jobId}" returned to feed (PL: Unprinted)`, 'info');
        
        setTimeout(() => updateAllTimelineScrollPositions(), 300);
    }
}

// ============================================================
// TIMELINE RULER - FIXED VERSION
// ============================================================

function generateTimelineRuler(timeline, startTime, endTime) {
    const container = timeline.closest('.timeline-container');
    if (!container) return;
    
    // Remove existing ruler and date header
    const existingRuler = container.querySelector('.timeline-ruler');
    if (existingRuler) existingRuler.remove();
    const existingDateHeader = container.querySelector('.timeline-date-header');
    if (existingDateHeader) existingDateHeader.remove();
    
    // Get the jobs to determine actual positions
    const jobs = timeline.querySelectorAll('.job');
    if (jobs.length === 0) return;
    
    const totalDuration = endTime - startTime;
    if (totalDuration <= 0) return;
    
    // Create date header
    const dateHeader = document.createElement('div');
    dateHeader.className = 'timeline-date-header';
    const startDate = new Date(startTime);
    const endDate = new Date(endTime);
    const today = new Date();
    
    dateHeader.innerHTML = `
        <span class="date-range">
            📅 ${startDate.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })} 
            → ${endDate.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
        </span>
        <span class="today-date">
            Today: ${today.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
        </span>
    `;
    
    // Create ruler
    const ruler = document.createElement('div');
    ruler.className = 'timeline-ruler';
    
    // Determine tick interval
    let tickInterval = 60 * 60 * 1000;
    let majorTickInterval = 2 * 60 * 60 * 1000;
    
    if (totalDuration > 24 * 60 * 60 * 1000) {
        tickInterval = 4 * 60 * 60 * 1000;
        majorTickInterval = 8 * 60 * 60 * 1000;
    } else if (totalDuration > 12 * 60 * 60 * 1000) {
        tickInterval = 2 * 60 * 60 * 1000;
        majorTickInterval = 4 * 60 * 60 * 1000;
    } else if (totalDuration > 6 * 60 * 60 * 1000) {
        tickInterval = 60 * 60 * 1000;
        majorTickInterval = 2 * 60 * 60 * 1000;
    } else if (totalDuration > 2 * 60 * 60 * 1000) {
        tickInterval = 30 * 60 * 1000;
        majorTickInterval = 60 * 60 * 1000;
    } else {
        tickInterval = 15 * 60 * 1000;
        majorTickInterval = 30 * 60 * 1000;
    }
    
    // Get total timeline width from jobs
    let totalJobWidth = 0;
    jobs.forEach(job => {
        totalJobWidth += job.offsetWidth + 6;
    });
    // Add padding (12px left + 12px right)
    totalJobWidth += 24;
    
    // If no jobs have width yet, use a default
    if (totalJobWidth < 100) totalJobWidth = 800;
    
    // Generate ticks positioned relative to job positions
    let tickTime = startTime;
    let tickCount = 0;
    const maxTicks = 200;
    
    // Get the first job's start position (relative to timeline)
    const firstJob = jobs[0];
    const firstJobId = firstJob.getAttribute('data-job-id');
    const firstJobStart = jobSchedule[firstJobId]?.startTime || startTime;
    
    while (tickTime <= endTime && tickCount < maxTicks) {
        // Calculate position based on time relative to first job
        const timeOffset = tickTime - firstJobStart;
        const totalTimeRange = endTime - firstJobStart;
        let leftPos = (timeOffset / totalTimeRange) * 100;
        
        // Clamp to visible range
        leftPos = Math.max(0, Math.min(100, leftPos));
        
        const tick = document.createElement('div');
        tick.className = 'ruler-tick';
        
        const isMajor = (tickTime % majorTickInterval === 0) || tickCount === 0;
        tick.classList.add(isMajor ? 'major-tick' : 'minor-tick');
        
        const date = new Date(tickTime);
        const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const dateStr = date.toLocaleDateString([], { month: 'short', day: 'numeric' });
        
        const showDate = isMajor || tickCount === 0 || 
            (tickCount > 0 && date.getDate() !== new Date(tickTime - tickInterval).getDate());
        
        tick.innerHTML = `
            <span class="tick-time">${timeStr}</span>
            ${showDate ? `<span class="tick-date">${dateStr}</span>` : ''}
        `;
        
        tick.style.left = `${leftPos}%`;
        ruler.appendChild(tick);
        tickTime += tickInterval;
        tickCount++;
    }
    
    // Add grid lines to the timeline
    addGridLines(timeline, startTime, endTime, totalDuration, tickInterval);
    
    // Insert date header and ruler BEFORE the timeline
    // Use insertBefore with the timeline as reference
    try {
        container.insertBefore(dateHeader, timeline);
        container.insertBefore(ruler, timeline);
    } catch (e) {
        // Fallback: append to container
        console.warn('InsertBefore failed, using appendChild fallback:', e.message);
        container.appendChild(dateHeader);
        container.appendChild(ruler);
    }
    
    // Add NOW marker to ruler
    updateNowIndicatorPosition(timeline);
}

function addGridLines(timeline, startTime, endTime, totalDuration, tickInterval) {
    // Remove existing grid lines
    timeline.querySelectorAll('.hour-grid-line').forEach(el => el.remove());
    
    if (totalDuration <= 0) return;
    
    // Get the first job for reference
    const jobs = timeline.querySelectorAll('.job');
    if (jobs.length === 0) return;
    
    const firstJob = jobs[0];
    const firstJobId = firstJob.getAttribute('data-job-id');
    const firstJobStart = jobSchedule[firstJobId]?.startTime || startTime;
    const totalTimeRange = endTime - firstJobStart;
    
    let gridTime = startTime;
    let count = 0;
    const maxGrids = 100;
    
    while (gridTime <= endTime && count < maxGrids) {
        const timeOffset = gridTime - firstJobStart;
        const leftPos = (timeOffset / totalTimeRange) * 100;
        
        if (leftPos >= 0 && leftPos <= 100) {
            const gridLine = document.createElement('div');
            gridLine.className = 'hour-grid-line';
            if (gridTime % (tickInterval * 2) !== 0) {
                gridLine.classList.add('half-hour');
            }
            gridLine.style.left = `${leftPos}%`;
            timeline.appendChild(gridLine);
        }
        
        gridTime += tickInterval;
        count++;
    }
}

// ============================================================
// UPDATED SCALE TIMELINE FUNCTION
// ============================================================

function scaleTimeline(timelineId) {
    const timeline = document.getElementById(timelineId);
    if (!timeline) return;
    
    const jobs = timeline.querySelectorAll('.job');
    if (jobs.length === 0) {
        // Clear ruler if no jobs
        const container = timeline.closest('.timeline-container');
        if (container) {
            container.querySelectorAll('.timeline-ruler, .timeline-date-header, .hour-grid-line').forEach(el => el.remove());
        }
        return;
    }
    
    // Calculate job durations and positions
    const jobDurations = [];
    let maxDuration = 0;
    let totalDuration = 0;
    let firstStartTime = Infinity;
    let lastEndTime = 0;
    let hasSchedule = false;
    
    jobs.forEach(job => {
        const jobId = job.getAttribute('data-job-id');
        const duration = calculateJobDuration(jobDatabase[jobId], jobId);
        jobDurations.push({ job, duration, jobId });
        if (duration > maxDuration) maxDuration = duration;
        totalDuration += duration;
        
        if (jobSchedule[jobId]) {
            hasSchedule = true;
            if (jobSchedule[jobId].startTime < firstStartTime) {
                firstStartTime = jobSchedule[jobId].startTime;
            }
            if (jobSchedule[jobId].endTime > lastEndTime) {
                lastEndTime = jobSchedule[jobId].endTime;
            }
        }
    });
    
    if (maxDuration === 0 || totalDuration === 0) {
        // Still need to render jobs even if duration is 0
        jobDurations.forEach(({ job }) => {
            let width = 80 * currentZoomLevel;
            width = Math.max(60, Math.min(300, width));
            applyJobStyle(job, width);
        });
        return;
    }
    
    // Set width based on duration with zoom
    const PIXELS_PER_MINUTE = 2.5;
    const MIN_WIDTH = 60;
    const MAX_WIDTH = 500;
    
    jobDurations.forEach(({ job, duration }) => {
        let width = duration * PIXELS_PER_MINUTE;
        width = width * currentZoomLevel;
        width = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, width));
        applyJobStyle(job, width);
    });
    
    // Generate ruler if we have schedule data
    if (hasSchedule && firstStartTime !== Infinity && lastEndTime > 0) {
        // Extend the time range slightly for better visual
        const extendedStart = firstStartTime;
        const extendedEnd = lastEndTime + (30 * 60 * 1000); // Add 30 min buffer
        generateTimelineRuler(timeline, extendedStart, extendedEnd);
    }
    
    updateNowIndicatorPosition(timeline);
}

// Helper function to apply styles to a job
function applyJobStyle(job, jobWidth) {
    // Round to 1 decimal place to avoid floating point issues
    jobWidth = Math.round(jobWidth * 10) / 10;
    
    job.style.width = `${jobWidth}px`;
    job.style.flexShrink = '0';
    job.style.minWidth = '50px';
    job.style.maxWidth = '600px';
    
    // Font sizes with better readability
    const fontSize = Math.max(9, Math.min(15, 12 * currentZoomLevel));
    const nameFontSize = Math.max(10, Math.min(17, 14 * currentZoomLevel));
    
    const jobName = job.querySelector('.job-name');
    if (jobName) jobName.style.fontSize = `${nameFontSize}px`;
    
    const jobDetails = job.querySelector('.job-details');
    if (jobDetails) jobDetails.style.fontSize = `${fontSize * 0.9}px`;
    
    const jobDurationEl = job.querySelector('.job-duration');
    if (jobDurationEl) jobDurationEl.style.fontSize = `${fontSize * 1.2}px`;
    
    const jobBreakdown = job.querySelector('.job-breakdown');
    if (jobBreakdown) jobBreakdown.style.fontSize = `${fontSize * 0.8}px`;
    
    const jobTime = job.querySelector('.job-time');
    if (jobTime) jobTime.style.fontSize = `${fontSize * 0.8}px`;
    
    const padding = Math.max(6, Math.min(14, 10 * currentZoomLevel));
    job.style.padding = `${padding}px ${padding * 1.5}px`;
}
// ============================================================
// SELECTION
// ============================================================
function selectJob(jobElement) {
    if (selectedJob) {
        selectedJob.classList.remove('job-selected');
    }
    jobElement.classList.add('job-selected');
    selectedJob = jobElement;
}

// ============================================================
// HANDLE ADD JOB
// ============================================================
function handleAddJob() {
    const jobName = document.getElementById('job-name').value.trim();
    const setupTime = parseInt(document.getElementById('setup-time').value);
    const quantity = parseInt(document.getElementById('quantity').value);
    
    if (!jobName) {
        alert('Please enter a job name');
        return;
    }
    if (isNaN(setupTime) || setupTime <= 0) {
        alert('Please enter a valid setup time (positive number)');
        return;
    }
    if (isNaN(quantity) || quantity <= 0) {
        alert('Please enter a valid quantity (positive number)');
        return;
    }
    
    const jobId = 'job-' + (Object.keys(jobDatabase).length + 1);
    
    jobDatabase[jobId] = {
        name: jobName,
        setup: setupTime,
        quantity: quantity,
        status: 'Missing Data',
        awStatus: 'Missing Data',
        planningStatus: 'Unprinted',
        statusDate: new Date(1900, 0, 1).toISOString(),
        jobNumber: 'JOB-' + String(Object.keys(jobDatabase).length + 1).padStart(3, '0')
    };
    
    const feedJob = createFeedJobElement(jobId, jobDatabase[jobId]);
    const productionFeedList = document.getElementById('production-feed-list');
    if (productionFeedList) {
        productionFeedList.appendChild(feedJob);
        applyFilter();
        updateStatistics();
    }
    
    document.getElementById('job-name').value = '';
    document.getElementById('setup-time').value = '';
    document.getElementById('quantity').value = '';
    
    alert('Job added successfully to production feed!');
}

// ============================================================
// SEARCH
// ============================================================
function handleSearch(e) {
    const searchTerm = e.target.value.toLowerCase();
    const feedJobs = document.querySelectorAll('.feed-job');
    feedJobs.forEach(job => {
        if (job.classList.contains('filter-hidden')) return;
        
        const jobName = job.querySelector('.feed-job-name')?.textContent?.toLowerCase() || '';
        const jobNumber = job.querySelector('.feed-job-number')?.textContent?.toLowerCase() || '';
        const isVisible = jobName.includes(searchTerm) || jobNumber.includes(searchTerm);
        job.style.display = isVisible ? 'flex' : 'none';
    });
}

// ============================================================
// KEYBOARD EVENTS
// ============================================================
function handleKeydown(e) {
    if (e.key === 'Delete' && selectedJob && selectedJob.classList.contains('job') && !selectedJob.classList.contains('job-printed')) {
        returnJobToFeed(selectedJob);
        selectedJob = null;
        updateAllJobColors();
    }
}

function handleClickOutside(e) {
    if (!e.target.closest('.job') && !e.target.closest('.feed-job') && !e.target.closest('.filter-panel')) {
        if (selectedJob) {
            selectedJob.classList.remove('job-selected');
            selectedJob = null;
        }
    }
    
    // Close filter panel when clicking outside
    const filterPanel = document.getElementById('filter-panel');
    if (filterPanel && filterPanel.classList.contains('active')) {
        if (!e.target.closest('.filter-panel') && !e.target.closest('.filter-btn')) {
            filterPanel.classList.remove('active');
        }
    }
}

// ============================================================
// TIME FUNCTIONS
// ============================================================
function updateTime() {
    const now = new Date();
    const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const currentTimeElement = document.getElementById('current-time');
    if (currentTimeElement) {
        currentTimeElement.textContent = timeString;
    }
    updateAllJobTimes();
    updateCompletedJobs();
}

// ============================================================
// UPDATE JOB TIME DISPLAY - with dynamic ruler update
// ============================================================

function updateJobTimeDisplay(jobId) {
    const jobElement = document.querySelector(`.job[data-job-id="${jobId}"]`);
    if (!jobElement || !jobSchedule[jobId]) return;
    
    const schedule = jobSchedule[jobId];
    const startTime = new Date(schedule.startTime);
    const endTime = new Date(schedule.endTime);
    
    // Update the main time element
    const timeElement = jobElement.querySelector('.job-time');
    if (timeElement) {
        timeElement.textContent = `${formatTime(startTime)} - ${formatTime(endTime)}`;
    }
    
    // Add or update time range element
    let timeRange = jobElement.querySelector('.job-time-range');
    if (!timeRange) {
        timeRange = document.createElement('div');
        timeRange.className = 'job-time-range';
        const jobDetails = jobElement.querySelector('.job-details');
        if (jobDetails) {
            jobDetails.appendChild(timeRange);
        } else {
            jobElement.appendChild(timeRange);
        }
    }
    
    const duration = (endTime - startTime) / (60 * 60 * 1000);
    if (duration >= 6) {
        timeRange.textContent = `${formatDateTime(startTime)} → ${formatDateTime(endTime)}`;
    } else {
        timeRange.textContent = `${formatTime(startTime)} → ${formatTime(endTime)}`;
    }
    
    jobElement.dataset.startTime = schedule.startTime;
    jobElement.dataset.endTime = schedule.endTime;
    
    // Update the ruler when job times change
    const timeline = jobElement.closest('.timeline');
    if (timeline) {
        const container = timeline.closest('.timeline-container');
        if (container) {
            // Remove old ruler and regenerate
            container.querySelectorAll('.timeline-ruler, .timeline-date-header').forEach(el => el.remove());
            timeline.querySelectorAll('.hour-grid-line').forEach(el => el.remove());
            scaleTimeline(timeline.id);
        }
    }
}
// ============================================================
// INITIALIZATION - add ruler refresh
// ============================================================

// Add to initializeApp function or call after initial load
function initializeTimelineRulers() {
    // Wait for DOM to settle then generate rulers
    setTimeout(() => {
        document.querySelectorAll('.timeline').forEach(timeline => {
            const jobs = timeline.querySelectorAll('.job');
            if (jobs.length > 0) {
                scaleTimeline(timeline.id);
            }
        });
    }, 500);
}

// Call this after initial load
document.addEventListener('DOMContentLoaded', function() {
    // Existing initialization...
    // Add this:
    setTimeout(initializeTimelineRulers, 1000);
});

function updateAllJobTimes() {
    for (let jobId in jobSchedule) {
        updateJobTimeDisplay(jobId);
    }
}

function startJobTimeUpdates() {
    setInterval(updateAllJobTimes, 60000);
}

function startDynamicTimeUpdates() {
    setInterval(() => {
        updateAllJobTimes();
        updateAllMachineStatuses();
        updateAllJobColors();
        updateCompletedJobs();
        updateAllTimelineScrollPositions();
    }, 30000);
}

function formatTime(date) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// ============================================================
// COMPLETED JOBS HANDLING
// ============================================================
function updateCompletedJobs() {
    const now = new Date().getTime();
    
    document.querySelectorAll('.timeline').forEach(timeline => {
        const jobs = timeline.querySelectorAll('.job:not(.job-printed)');
        let completedJobs = [];
        
        jobs.forEach(job => {
            const jobId = job.getAttribute('data-job-id');
            if (jobSchedule[jobId] && jobSchedule[jobId].endTime <= now) {
                job.classList.add('job-printed');
                jobSchedule[jobId].isPrinted = true;
                jobDatabase[jobId].status = 'Complete';
                jobDatabase[jobId].planningStatus = 'Complete';
                job.setAttribute('draggable', 'false');
                
                const statusBadge = job.querySelector('.job-status-badge');
                if (statusBadge) {
                    statusBadge.textContent = 'Complete';
                    statusBadge.style.color = '#95a5a6';
                }
                
                completedJobs.push(job);
            }
        });
        
        // Keep only last 5 printed jobs
        const printedJobs = timeline.querySelectorAll('.job.job-printed');
        if (printedJobs.length > 5) {
            const toRemove = Array.from(printedJobs).slice(5);
            toRemove.forEach(job => {
                const jobId = job.getAttribute('data-job-id');
                delete jobSchedule[jobId];
                job.remove();
            });
        }
        
        // Sort printed jobs by end time (oldest first, newest last)
        const printedJobsList = timeline.querySelectorAll('.job.job-printed');
        if (printedJobsList.length > 1) {
            const sorted = Array.from(printedJobsList).sort((a, b) => {
                const idA = a.getAttribute('data-job-id');
                const idB = b.getAttribute('data-job-id');
                return (jobSchedule[idA]?.endTime || 0) - (jobSchedule[idB]?.endTime || 0);
            });
            
            sorted.forEach(job => timeline.appendChild(job));
        }
        
        updateMachineStatus(timeline.closest('.machine'));
        updateStatistics();
    });
}

// ============================================================
// MACHINE STATUS
// ============================================================
function updateMachineStatus(machine) {
    if (!machine) return;
    
    const timeline = machine.querySelector('.timeline');
    if (!timeline) return;
    
    const jobs = timeline.querySelectorAll('.job:not(.job-printed)');
    const statusElement = machine.querySelector('.machine-status');
    
    if (!statusElement) return;
    
    if (jobs.length > 0) {
        statusElement.textContent = 'Active';
        statusElement.className = 'machine-status status-active';
    } else {
        statusElement.textContent = 'Idle';
        statusElement.className = 'machine-status status-idle';
    }
}

function updateAllMachineStatuses() {
    document.querySelectorAll('.machine').forEach(machine => {
        updateMachineStatus(machine);
    });
}

// ============================================================
// JOB COLORS
// ============================================================
function updateJobColors(timelineId) {
    const timeline = document.getElementById(timelineId);
    if (!timeline) return;
    
    const jobs = timeline.querySelectorAll('.job:not(.job-printed)');
    jobs.forEach((job, index) => {
        job.classList.remove('job-current-color', 'job-next-color', 'job-second-color', 'job-future-color');
        
        if (index === 0) {
            job.style.backgroundColor = jobColors.current;
            job.classList.add('job-current-color');
        } else if (index === 1) {
            job.style.backgroundColor = jobColors.next;
            job.classList.add('job-next-color');
        } else if (index === 2) {
            job.style.backgroundColor = jobColors.second;
            job.classList.add('job-second-color');
        } else {
            job.style.backgroundColor = jobColors.future;
            job.classList.add('job-future-color');
        }
    });
}

function updateAllJobColors() {
    document.querySelectorAll('.timeline').forEach(timeline => {
        updateJobColors(timeline.id);
    });
}

// ============================================================
// NOW INDICATOR
// ============================================================
function initializeNowIndicators() {
    document.querySelectorAll('.timeline').forEach(timeline => {
        createNowIndicator(timeline);
    });
    updateAllNowIndicators();
    nowIndicatorInterval = setInterval(updateAllNowIndicators, 60000);
}

function createNowIndicator(timeline) {
    const existingIndicator = timeline.querySelector('.now-indicator');
    const existingLine = timeline.querySelector('.now-indicator-line');
    if (existingIndicator) existingIndicator.remove();
    if (existingLine) existingLine.remove();
    
    const nowIndicator = document.createElement('div');
    nowIndicator.className = 'now-indicator';
    nowIndicator.id = `now-indicator-${timeline.id}`;
    
    const nowLine = document.createElement('div');
    nowLine.className = 'now-indicator-line';
    nowLine.id = `now-line-${timeline.id}`;
    
    timeline.appendChild(nowIndicator);
    timeline.appendChild(nowLine);
}

// ============================================================
// UPDATE NOW INDICATOR POSITION - enhanced
// ============================================================

// Replace the existing updateNowIndicatorPosition function
function updateNowIndicatorPosition(timeline) {
    const nowIndicator = timeline.querySelector('.now-indicator');
    const nowLine = timeline.querySelector('.now-indicator-line');
    if (!nowIndicator || !nowLine) return;
    
    const now = new Date();
    const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    let positionPercentage = 5;
    
    const jobs = timeline.querySelectorAll('.job:not(.job-printed)');
    if (jobs.length > 0 && jobSchedule[jobs[0]?.getAttribute('data-job-id')]) {
        const firstJobId = jobs[0].getAttribute('data-job-id');
        const lastJobId = jobs[jobs.length - 1].getAttribute('data-job-id');
        const firstStart = jobSchedule[firstJobId]?.startTime || 0;
        const lastEnd = jobSchedule[lastJobId]?.endTime || firstStart + 3600000;
        const totalDuration = lastEnd - firstStart;
        
        if (totalDuration > 0) {
            const elapsed = now.getTime() - firstStart;
            positionPercentage = Math.min(95, Math.max(2, (elapsed / totalDuration) * 100));
        }
    }
    
    nowIndicator.style.left = `${positionPercentage}%`;
    nowLine.style.left = `${positionPercentage}%`;
    nowIndicator.setAttribute('data-time', timeString);
    
    // Also update ruler's now marker if exists
    const ruler = timeline.closest('.timeline-container')?.querySelector('.timeline-ruler');
    if (ruler) {
        let nowMarker = ruler.querySelector('.ruler-now-marker');
        if (!nowMarker) {
            nowMarker = document.createElement('div');
            nowMarker.className = 'ruler-now-marker';
            ruler.appendChild(nowMarker);
        }
        nowMarker.style.left = `${positionPercentage}%`;
    }
}

// ============================================================
// UPDATE ALL NOW INDICATORS - enhanced
// ============================================================

// Replace the existing updateAllNowIndicators function
function updateAllNowIndicators() {
    document.querySelectorAll('.timeline').forEach(timeline => {
        updateNowIndicatorPosition(timeline);
    });
}

// ============================================================
// REFRESH ALL TIMELINES - updated
// ============================================================

function refreshAllTimelines() {
    document.querySelectorAll('.timeline').forEach(timeline => {
        const container = timeline.closest('.timeline-container');
        if (container) {
            // Remove existing ruler and date header
            container.querySelectorAll('.timeline-ruler, .timeline-date-header').forEach(el => el.remove());
        }
        // Remove grid lines
        timeline.querySelectorAll('.hour-grid-line').forEach(el => el.remove());
        // Regenerate timeline
        scaleTimeline(timeline.id);
    });
}

// ============================================================
// SMART ZOOM FUNCTIONALITY
// ============================================================
function initializeZoomControls() {
    const zoomInBtn = document.getElementById('zoom-in');
    const zoomOutBtn = document.getElementById('zoom-out');
    const zoomResetBtn = document.getElementById('zoom-reset');
    
    if (zoomInBtn) zoomInBtn.addEventListener('click', smartZoomIn);
    if (zoomOutBtn) zoomOutBtn.addEventListener('click', smartZoomOut);
    if (zoomResetBtn) zoomResetBtn.addEventListener('click', smartResetZoom);
    
    document.addEventListener('keydown', function(e) {
        if ((e.ctrlKey || e.metaKey) && (e.key === '+' || e.key === '=')) {
            e.preventDefault();
            smartZoomIn();
        } else if ((e.ctrlKey || e.metaKey) && e.key === '-') {
            e.preventDefault();
            smartZoomOut();
        } else if ((e.ctrlKey || e.metaKey) && e.key === '0') {
            e.preventDefault();
            smartResetZoom();
        }
    });
    
    const machinesContainer = document.getElementById('machines-scroll-container');
    if (machinesContainer) {
        machinesContainer.addEventListener('wheel', function(e) {
            if (e.ctrlKey || e.metaKey) {
                e.preventDefault();
                if (e.deltaY < 0) smartZoomIn();
                else smartZoomOut();
            }
        }, { passive: false });
    }
    
    updateZoomDisplay();
}

function smartZoomIn() {
    if (currentZoomLevel < MAX_ZOOM) {
        currentZoomLevel = Math.min(currentZoomLevel + ZOOM_STEP, MAX_ZOOM);
        applySmartZoom();
        updateZoomDisplay();
        showZoomIndicator('Zoom In');
    }
}

function smartZoomOut() {
    if (currentZoomLevel > MIN_ZOOM) {
        currentZoomLevel = Math.max(currentZoomLevel - ZOOM_STEP, MIN_ZOOM);
        applySmartZoom();
        updateZoomDisplay();
        showZoomIndicator('Zoom Out');
    }
}

function smartResetZoom() {
    currentZoomLevel = 1.0;
    applySmartZoom();
    updateZoomDisplay();
    showZoomIndicator('Reset Zoom');
}

function applySmartZoom() {
    document.querySelectorAll('.timeline').forEach(timeline => {
        scaleTimeline(timeline.id);
    });
    updateAllNowIndicators();
    setTimeout(() => updateAllTimelineScrollPositions(), 200);
}

function updateZoomDisplay() {
    const zoomLevelDisplay = document.getElementById('zoom-level');
    if (zoomLevelDisplay) {
        zoomLevelDisplay.textContent = `${Math.round(currentZoomLevel * 100)}%`;
    }
}

function showZoomIndicator(message) {
    let indicator = document.querySelector('.zoom-indicator');
    if (!indicator) {
        indicator = document.createElement('div');
        indicator.className = 'zoom-indicator';
        document.querySelector('.machines-section').appendChild(indicator);
    }
    
    indicator.textContent = `${message}: ${Math.round(currentZoomLevel * 100)}%`;
    indicator.classList.add('visible');
    
    if (window.zoomIndicatorTimeout) {
        clearTimeout(window.zoomIndicatorTimeout);
    }
    window.zoomIndicatorTimeout = setTimeout(() => {
        indicator.classList.remove('visible');
    }, 2000);
}

// ============================================================
// EXCEL UPLOAD FUNCTIONALITY
// ============================================================
function setupExcelUploads() {
    // AW Upload
    const uploadBtnAW = document.getElementById('upload-excel-aw');
    const fileInputAW = document.getElementById('file-input-aw');
    
    if (uploadBtnAW && fileInputAW) {
        uploadBtnAW.addEventListener('click', function() {
            console.log('AW Upload button clicked');
            fileInputAW.click();
        });
        
        fileInputAW.addEventListener('change', function(e) {
            const file = this.files[0];
            if (file) {
                console.log('AW file selected:', file.name);
                // Check if file name contains "AW" (case insensitive)
                if (file.name.toLowerCase().includes('aw')) {
                    handleAWUpload(file);
                } else {
                    alert('Please upload a file named "AW"');
                }
            }
            this.value = '';
        });
    } else {
        console.warn('AW upload elements not found');
    }
    
    // PL Upload
    const uploadBtnPL = document.getElementById('upload-excel-pl');
    const fileInputPL = document.getElementById('file-input-pl');
    
    if (uploadBtnPL && fileInputPL) {
        uploadBtnPL.addEventListener('click', function() {
            console.log('PL Upload button clicked');
            fileInputPL.click();
        });
        
        fileInputPL.addEventListener('change', function(e) {
            const file = this.files[0];
            if (file) {
                console.log('PL file selected:', file.name);
                // Check if file name contains "CI Planning Shared" (case insensitive)
                if (file.name.toLowerCase().includes('ci planning shared')) {
                    handlePLUpload(file);
                } else {
                    alert('Please upload a file named "CI Planning Shared"');
                }
            }
            this.value = '';
        });
    } else {
        console.warn('PL upload elements not found');
    }
}

// ============================================================
// AW UPLOAD - Overwrites AW data only, updates status in PL jobs
// ============================================================
function handleAWUpload(file) {
    console.log('Uploading AW Excel file:', file.name);
    
    showUploadProgress('Reading AW file...', 10);
    
    const reader = new FileReader();
    
    reader.onload = function(e) {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            
            // Get the first sheet (AW has only one sheet)
            const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
            const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });
            
            console.log('AW data rows:', jsonData.length);
            
            showUploadProgress('Processing AW data...', 50);
            
            // AW format: first 3 rows are headers
            // F: Job Number (index 5), I: Status Entry (index 8)
            // AG: 1. Under Job-Study (index 32), AI: 2. Under QC Check (index 34)
            // AK: 3. S.C Approval (index 36), AM: 4. Need S.C Approval (index 38)
            // AO: 5. Working on Cromalin (index 40), AQ: 6. Need Cromalin Approval (index 42)
            // AS: 7. Cromalin Approval (index 44), AU: 8. Repro: Plate Making (index 46)
            // AW: 9. Plates are Ready (index 48)
            
            const rows = jsonData.slice(3); // Skip first 3 header rows
            let awJobsFound = 0;
            
            rows.forEach((row, index) => {
                if (!row || row.length < 10) {
                    console.log(`Row ${index + 4} has insufficient data, skipping`);
                    return;
                }
                
                const jobNumber = String(row[5] || '').trim(); // Column F (index 5)
                const status = String(row[8] || '').trim(); // Column I (index 8) - Status Entry
                
                if (!jobNumber) {
                    console.log(`Row ${index + 4} has no job number, skipping`);
                    return;
                }
                
                console.log(`Processing AW job: ${jobNumber}, status: "${status}"`);
                
                // Find the date for the current status
                let statusDate = null;
                
                // Check if status is one of the known statuses and get the corresponding date
                const statusDateMap = {
                    '1. Under Job-Study': { index: 32, label: 'AG' },
                    '2. Under QC Check': { index: 34, label: 'AI' },
                    '3. S.C Approval': { index: 36, label: 'AK' },
                    '4. Need S.C Approval': { index: 38, label: 'AM' },
                    '5. Working on Cromalin': { index: 40, label: 'AO' },
                    '6. Need Cromalin Approval': { index: 42, label: 'AQ' },
                    '7. Cromalin Approval': { index: 44, label: 'AS' },
                    '8. Repro: Plate Making': { index: 46, label: 'AU' },
                    '9. Plates are Ready': { index: 48, label: 'AW' }
                };
                
                // Get the date for the current status
                if (status && statusDateMap[status]) {
                    const dateInfo = statusDateMap[status];
                    const dateValue = row[dateInfo.index];
                    console.log(`Status ${status} date from column ${dateInfo.label}:`, dateValue);
                    
                    if (dateValue !== undefined && dateValue !== null && dateValue !== '') {
                        // Check if it's a number (Excel date serial)
                        if (typeof dateValue === 'number' && dateValue > 0) {
                            // Excel date serial to JS Date
                            const excelEpoch = new Date(1899, 11, 30);
                            const jsDate = new Date(excelEpoch.getTime() + dateValue * 86400000);
                            if (!isNaN(jsDate.getTime())) {
                                statusDate = jsDate;
                                console.log(`Parsed Excel date: ${jsDate.toISOString()}`);
                            }
                        } else if (typeof dateValue === 'string') {
                            // Try to parse as date string
                            const parsed = new Date(dateValue);
                            if (!isNaN(parsed.getTime()) && parsed.getFullYear() > 1900) {
                                statusDate = parsed;
                                console.log(`Parsed string date: ${parsed.toISOString()}`);
                            }
                        }
                    }
                }
                
                // If no status date found, use 01/01/1900
                if (!statusDate) {
                    statusDate = new Date(1900, 0, 1);
                    console.log(`No date found for ${jobNumber}, using 01/01/1900`);
                }
                
                // IMPORTANT: Store the raw status from the file
                // If status is empty/blank, it's "Unknown", NOT "Missing Data"
                let rawStatus = status || 'Unknown';
                
                // Store AW data with the raw status
                awData[jobNumber] = {
                    status: rawStatus,  // This is the raw status from the file
                    rawStatus: rawStatus,
                    statusDate: statusDate.toISOString(),
                    isFromAW: true  // Flag to indicate this came from AW file
                };
                
                // Check if this job exists in PL database and update its status
                let jobId = findJobIdByNumber(jobNumber);
                if (jobId) {
                    console.log(`Found matching job in PL: ${jobId}`);
                    // Update status in jobDatabase
                    if (jobDatabase[jobId]) {
                        // Store the raw AW status
                        jobDatabase[jobId].awStatus = rawStatus;
                        jobDatabase[jobId].status = rawStatus;
                        jobDatabase[jobId].statusDate = statusDate.toISOString();
                        jobDatabase[jobId].rawAWStatus = rawStatus; // Store raw status separately
                        
                        // Update PL data if exists
                        if (plDatabase[jobId]) {
                            plDatabase[jobId].prepressStatus = rawStatus;
                            plDatabase[jobId].statusDate = statusDate.toISOString();
                            plDatabase[jobId].rawAWStatus = rawStatus;
                        }
                        
                        awJobsFound++;
                    }
                } else {
                    console.log(`No matching job found for ${jobNumber} in PL database`);
                }
            });
            
            // Re-sort the production feed
            populateProductionFeed();
            
            // Apply filter to show/hide based on new statuses
            applyFilter();
            updateFilterCounts(); 
            
            showUploadProgress(`AW upload complete: ${awJobsFound} jobs updated`, 100);
            
            setTimeout(() => {
                hideUploadProgress();
                updateStatistics();
                console.log('AW upload completed successfully');
            }, 1500);
            
        } catch (error) {
            console.error('Error processing AW file:', error);
            showUploadProgress('Error processing AW file', 100);
            setTimeout(() => hideUploadProgress(), 3000);
            alert('Error reading AW Excel file. Please check the file format.\nError: ' + error.message);
        }
    };
    
    reader.onerror = function() {
        console.error('Error reading AW file');
        showUploadProgress('Error reading file', 100);
        setTimeout(() => hideUploadProgress(), 3000);
        alert('Error reading file. Please try again.');
    };
    
    reader.readAsArrayBuffer(file);
}

function mapAWStatusToPlanningStatus(awStatus) {
    // Map AW status to planning status
    if (!awStatus) return 'Missing Data';
    
    // If status is "Printed" or "Complete", map to Complete
    if (awStatus === 'Printed' || awStatus === 'Complete') {
        return 'Complete';
    }
    
    // If status contains any of the PL statuses, map accordingly
    const statusMap = {
        '1. Under Job-Study': 'Planned',
        '2. Under QC Check': 'Planned',
        '3. S.C Approval': 'Planned',
        '4. Need S.C Approval': 'Planned',
        '5. Working on Cromalin': 'Planned',
        '6. Need Cromalin Approval': 'Planned',
        '7. Cromalin Approval': 'Planned',
        '8. Repro: Plate Making': 'Planned',
        '9. Plates are Ready': 'Planned'
    };
    
    // Check if the status matches any of the mapped keys
    for (const [key, value] of Object.entries(statusMap)) {
        if (awStatus.includes(key) || key.includes(awStatus)) {
            return value;
        }
    }
    
    // If status is "Deleted" or "On Hold", keep as-is
    if (awStatus === 'Deleted' || awStatus === 'On Hold') {
        return awStatus;
    }
    
    return 'Missing Data';
}

function findJobIdByNumber(jobNumber) {
    for (const [id, data] of Object.entries(jobDatabase)) {
        if (data.jobNumber === jobNumber) {
            return id;
        }
    }
    return null;
}

// ============================================================
// PL UPLOAD - Updates/creates jobs from PL data, preserves timelines
// ============================================================
function handlePLUpload(file) {
    console.log('Uploading PL Excel file:', file.name);
    
    showUploadProgress('Reading PL file...', 10);
    
    const reader = new FileReader();
    
    reader.onload = function(e) {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            
            // Get the PLAN-WEEK sheet
            let sheet = null;
            let sheetName = null;
            
            for (const name of workbook.SheetNames) {
                if (name.toLowerCase().includes('plan-week')) {
                    sheetName = name;
                    sheet = workbook.Sheets[name];
                    break;
                }
            }
            
            if (!sheet) {
                showUploadProgress('Sheet "PLAN-WEEK" not found', 100);
                setTimeout(() => hideUploadProgress(), 3000);
                alert('Sheet "PLAN-WEEK" not found in the uploaded file.');
                return;
            }
            
            const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 });
            
            console.log('PL data rows:', jsonData.length);
            
            showUploadProgress('Processing PL data...', 30);
            
            // First row is header
            const rows = jsonData.slice(1);
            let jobsAdded = 0;
            let jobsUpdated = 0;
            
            rows.forEach((row, index) => {
                if (!row || row.length < 25) {
                    console.log(`Row ${index + 2} has insufficient data, skipping`);
                    return;
                }
                
                // Map columns based on the provided structure
                const jobNumber = String(row[0] || '').trim(); // A: Job Number
                const jobName = String(row[1] || '').trim(); // B: Job Name
                const newPlat = String(row[2] || '').trim(); // C: NEW PLAT
                const materialAvailability = String(row[4] || '').trim(); // E: Material Availability2
                const planningStatus = String(row[5] || '').trim(); // F: Planning Status - CRITICAL: must be "Planned" to appear on timelines
                const delivered = String(row[6] || '').trim(); // G: DELIVERED
                const delivered2 = String(row[7] || '').trim(); // H: DELIVERED2
                const machine = String(row[8] || '').trim(); // I: Machine
                const cuttingMethod = String(row[10] || '').trim(); // K: Cutting Method
                const quantity = parseFloat(row[11]) || 0; // L: Quantity (WEIGHT)
                const film = String(row[12] || '').trim(); // M: Film
                const thickness = String(row[13] || '').trim(); // N: Thickness
                const materialType = String(row[14] || '').trim(); // O: Material Type
                const machineSpeed = parseFloat(row[15]) || 200; // P: Machine Speed
                const meters = parseFloat(row[16]) || 0; // Q: Meters
                const setupTime = parseFloat(row[17]) || 120; // R: setup time in minutes
                const requiredTime = parseFloat(row[18]) || 0; // S: Required Time
                const plannedSpeed = parseFloat(row[19]) || 200; // T: Planned Speed
                const actualSpeed = parseFloat(row[20]) || 200; // U: Actual Speed
                const plannedSetup = parseFloat(row[21]) || 120; // V: Planned Setup time
                const actualSetup = parseFloat(row[22]) || 0; // W: Actual Setup
                const downtime = parseFloat(row[23]) || 0; // X: DOWNTIME
                const printingDuration = parseFloat(row[24]) || 0; // Y: Printing duration
                
                if (!jobNumber) {
                    console.log(`Row ${index + 2} has no job number, skipping`);
                    return;
                }
                
                console.log(`Processing PL job: ${jobNumber}, planningStatus: "${planningStatus}"`);
                
                // Check if job exists in AW data for status
                let awStatus = 'Unknown'; // Changed from 'Missing Data' to 'Unknown'
                let statusDate = new Date(1900, 0, 1); // Default to 01/01/1900
                
                if (awData[jobNumber]) {
                    awStatus = awData[jobNumber].status || 'Unknown';
                    if (awData[jobNumber].statusDate) {
                        const parsedDate = new Date(awData[jobNumber].statusDate);
                        if (!isNaN(parsedDate.getTime()) && parsedDate.getFullYear() > 1900) {
                            statusDate = parsedDate;
                        }
                    }
                    console.log(`Found AW data for ${jobNumber}: ${awStatus}`);
                } else {
                    console.log(`No AW data found for ${jobNumber} - setting AW status to "Unknown"`);
                }
                
                // Determine job status based on Planning Status from PL file
                const isPlanned = planningStatus === 'Planned';
                const isComplete = planningStatus === 'Complete' || planningStatus === 'Printed';
                const isUnprinted = planningStatus === 'Unprinted';
                
                console.log(`Job ${jobNumber} - isPlanned: ${isPlanned}, isComplete: ${isComplete}, isUnprinted: ${isUnprinted}`);
                
                // Check if job already exists in database
                let jobId = findJobIdByNumber(jobNumber);
                let isNew = false;
                
                if (!jobId) {
                    // Create new job
                    jobId = 'job-' + (Object.keys(jobDatabase).length + 1);
                    isNew = true;
                    console.log(`Creating new job: ${jobId}`);
                } else {
                    console.log(`Updating existing job: ${jobId}`);
                }
                
                // Get effective status for display (AW status is the main status, but PL status overrides for filtering)
                let effectiveStatus = awStatus;
                
                // Override with planning status if it provides better info
                if (isComplete) {
                    effectiveStatus = 'Complete';
                } else if (isPlanned) {
                    effectiveStatus = 'Planned';
                } else if (isUnprinted) {
                    effectiveStatus = 'Unprinted';
                }
                
                // Update or create job
                jobDatabase[jobId] = {
                    name: jobName || 'Unnamed Job',
                    jobNumber: jobNumber,
                    status: effectiveStatus,
                    awStatus: awStatus, // Now "Unknown" if not in AW data
                    planningStatus: planningStatus || 'Unprinted',
                    statusDate: statusDate.toISOString(),
                    setup: setupTime || plannedSetup || 120,
                    quantity: meters || quantity || 0,
                    isComplete: isComplete,
                    isPlanned: isPlanned,
                    isUnprinted: isUnprinted,
                    // Store PL data
                    newPlat: newPlat,
                    materialAvailability: materialAvailability,
                    delivered: delivered,
                    delivered2: delivered2,
                    machine: machine,
                    cuttingMethod: cuttingMethod,
                    film: film,
                    thickness: thickness,
                    materialType: materialType,
                    machineSpeed: machineSpeed,
                    meters: meters,
                    setupTime: setupTime,
                    requiredTime: requiredTime,
                    plannedSpeed: plannedSpeed,
                    actualSpeed: actualSpeed,
                    plannedSetup: plannedSetup,
                    actualSetup: actualSetup,
                    downtime: downtime,
                    printingDuration: printingDuration
                };
                
                // Store PL data separately for export
                plDatabase[jobId] = {
                    jobNumber: jobNumber,
                    jobName: jobName,
                    newPlat: newPlat,
                    prepressStatus: awStatus || 'Unknown', // Now "Unknown" if not in AW data
                    materialAvailability: materialAvailability,
                    planningStatus: planningStatus || 'Unprinted',
                    delivered: delivered,
                    delivered2: delivered2,
                    machine: machine,
                    cuttingMethod: cuttingMethod,
                    quantity: quantity,
                    film: film,
                    thickness: thickness,
                    materialType: materialType,
                    machineSpeed: machineSpeed,
                    meters: meters,
                    setupTime: setupTime,
                    requiredTime: requiredTime,
                    plannedSpeed: plannedSpeed,
                    actualSpeed: actualSpeed,
                    plannedSetup: plannedSetup,
                    actualSetup: actualSetup,
                    downtime: downtime,
                    printingDuration: printingDuration,
                    isComplete: isComplete,
                    isPlanned: isPlanned,
                    isUnprinted: isUnprinted,
                    statusDate: statusDate.toISOString()
                };
                
                // IMPORTANT: Only add to timeline if:
                // 1. Machine is assigned AND
                // 2. Planning Status is EXACTLY "Planned" (not Complete, not Unprinted)
                if (machine && machineIdMap[machine] && isPlanned) {
                    const machineId = machineIdMap[machine];
                    const timelineId = `timeline-${machineId}`;
                    const timeline = document.getElementById(timelineId);
                    
                    // Check if job is already on timeline
                    const existingJob = document.querySelector(`.job[data-job-id="${jobId}"]`);
                    if (!existingJob && timeline) {
                        // Add job to timeline
                        const now = new Date().getTime();
                        addJobToTimelineWithSchedule(jobId, timelineId, now);
                        console.log(`Added ${jobId} to ${timelineId} (Planned status)`);
                    } else if (existingJob) {
                        // Update existing job on timeline
                        updateJobCardDisplay(jobId);
                        console.log(`Updated ${jobId} on timeline`);
                    }
                } else if (!isPlanned) {
                    // If job is NOT Planned (Complete, Unprinted, etc.), remove from timeline if it exists
                    const existingJob = document.querySelector(`.job[data-job-id="${jobId}"]`);
                    if (existingJob) {
                        const timeline = existingJob.parentElement;
                        existingJob.remove();
                        delete jobSchedule[jobId];
                        if (timeline) {
                            scaleTimeline(timeline.id);
                            updateMachineStatus(timeline.closest('.machine'));
                        }
                        console.log(`Removed ${jobId} from timeline (status: ${planningStatus})`);
                    }
                }
                
                if (isNew) {
                    jobsAdded++;
                } else {
                    jobsUpdated++;
                }
            });
            
            // Refresh production feed
            populateProductionFeed();
            
            // Update all timelines
            document.querySelectorAll('.timeline').forEach(timeline => {
                rescheduleTimelineJobs(timeline.id);
                scaleTimeline(timeline.id);
            });
            
            updateAllMachineStatuses();
            updateAllJobColors();
            updateAllJobTimes();
            updateAllNowIndicators();
            
            showUploadProgress(`PL upload complete: ${jobsAdded} added, ${jobsUpdated} updated`, 100);
            
            setTimeout(() => {
                hideUploadProgress();
                updateStatistics();
                applySmartZoom();
                setTimeout(() => updateAllTimelineScrollPositions(), 300);
                console.log('PL upload completed successfully');
            }, 1500);
            
        } catch (error) {
            console.error('Error processing PL file:', error);
            showUploadProgress('Error processing PL file', 100);
            setTimeout(() => hideUploadProgress(), 3000);
            alert('Error reading PL Excel file. Please check the file format.\nError: ' + error.message);
        }
    };
    
    reader.onerror = function() {
        console.error('Error reading PL file');
        showUploadProgress('Error reading file', 100);
        setTimeout(() => hideUploadProgress(), 3000);
        alert('Error reading file. Please try again.');
    };
    
    reader.readAsArrayBuffer(file);
}

// ============================================================
// EXPORT PL - Downloads current data as "Downloaded Planning"
// ============================================================
function setupExcelExport() {
    const downloadBtn = document.getElementById('download-excel-pl');
    if (downloadBtn) {
        downloadBtn.addEventListener('click', exportPLData);
    }
}

function exportPLData() {
    console.log('Exporting PL data...');
    showUploadProgress('Generating export...', 30);
    
    try {
        // Create header row matching the PL format
        const headers = [
            'Job Number', 'Job Name', 'NEW PLAT', 'Prepress status', 'Material Availability2',
            'Planning Status', 'DELIVERED', 'DELIVERED2', 'Machine', '', 'Cutting Method',
            'Quantity (WEIGHT)', 'Film', 'Thickness', 'Material Type', 'Machine Speed',
            'Meters', 'setup time in minuets', 'Required Time', 'Planned Speed',
            'Actual Speed', 'Planned Setup time', 'Actual Setup', 'DOWNTIME', 'Printing duration'
        ];
        
        // Get all jobs from PL database
        const exportData = [headers];
        
        for (const [jobId, data] of Object.entries(plDatabase)) {
            // Get current values from jobDatabase (which may have been updated)
            const jobData = jobDatabase[jobId] || {};
            const currentSpeed = jobSpeeds[jobId] || jobData.machineSpeed || 200;
            
            const row = [
                data.jobNumber || '',
                data.jobName || jobData.name || '',
                data.newPlat || '',
                data.prepressStatus || jobData.awStatus || '',
                data.materialAvailability || '',
                data.planningStatus || jobData.status || 'Planned',
                data.delivered || '',
                data.delivered2 || '',
                data.machine || jobData.machine || '',
                '', // Empty column J
                data.cuttingMethod || jobData.cuttingMethod || '',
                data.quantity || jobData.quantity || 0,
                data.film || jobData.film || '',
                data.thickness || jobData.thickness || '',
                data.materialType || jobData.materialType || '',
                currentSpeed,
                data.meters || jobData.quantity || 0,
                data.setupTime || jobData.setup || 120,
                data.requiredTime || jobData.requiredTime || 0,
                data.plannedSpeed || currentSpeed,
                data.actualSpeed || currentSpeed,
                data.plannedSetup || jobData.setup || 120,
                data.actualSetup || jobData.actualSetup || 0,
                data.downtime || jobData.downtime || 0,
                data.printingDuration || jobData.printingDuration || 0
            ];
            exportData.push(row);
        }
        
        // Create workbook
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet(exportData);
        XLSX.utils.book_append_sheet(wb, ws, 'PLAN-WEEK');
        
        // Generate file
        const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
        const blob = new Blob([wbout], { type: 'application/octet-stream' });
        const url = URL.createObjectURL(blob);
        
        // Download
        const link = document.createElement('a');
        link.href = url;
        link.download = 'Downloaded Planning.xlsx';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
        showUploadProgress(`Exported ${Object.keys(plDatabase).length} jobs`, 100);
        setTimeout(() => hideUploadProgress(), 2000);
        
        console.log('Export completed successfully');
        
    } catch (error) {
        console.error('Error exporting PL data:', error);
        showUploadProgress('Error exporting data', 100);
        setTimeout(() => hideUploadProgress(), 3000);
        alert('Error exporting data: ' + error.message);
    }
}

// ============================================================
// PROGRESS INDICATOR
// ============================================================
function showUploadProgress(message, percentage) {
    let progressElement = document.querySelector('.upload-progress');
    
    if (!progressElement) {
        progressElement = document.createElement('div');
        progressElement.className = 'upload-progress';
        progressElement.innerHTML = `
            <div class="progress-text">Uploading...</div>
            <div class="progress-bar">
                <div class="progress-fill" style="width: 0%"></div>
            </div>
        `;
        document.body.appendChild(progressElement);
    }
    
    const textElement = progressElement.querySelector('.progress-text');
    const fillElement = progressElement.querySelector('.progress-fill');
    
    if (textElement) textElement.textContent = message;
    if (fillElement) fillElement.style.width = `${Math.min(percentage, 100)}%`;
    
    progressElement.classList.add('active');
}

function hideUploadProgress() {
    const progressElement = document.querySelector('.upload-progress');
    if (progressElement) {
        progressElement.classList.remove('active');
        setTimeout(() => {
            progressElement.remove();
        }, 500);
    }
}

// ============================================================
// SAMPLE JOB BUTTON
// ============================================================
document.addEventListener('DOMContentLoaded', function() {
    const sampleJobBtn = document.getElementById('add-sample-job');
    if (sampleJobBtn) {
        sampleJobBtn.addEventListener('click', function() {
            const sampleJobs = [
                { name: 'Sample 001', setup: 45, quantity: 500 },
                { name: 'Sample 002', setup: 30, quantity: 1000 },
                { name: 'Sample 003', setup: 60, quantity: 200 }
            ];
            
            sampleJobs.forEach((job, index) => {
                const jobId = 'sample-' + (Object.keys(jobDatabase).length + 1);
                jobDatabase[jobId] = {
                    name: job.name,
                    setup: job.setup,
                    quantity: job.quantity,
                    status: 'Planned',
                    awStatus: 'Planned',
                    planningStatus: 'Planned',
                    statusDate: new Date().toISOString(),
                    jobNumber: 'SMPL-' + String(index + 1).padStart(3, '0')
                };
                
                const feedJob = createFeedJobElement(jobId, jobDatabase[jobId]);
                const productionFeedList = document.getElementById('production-feed-list');
                if (productionFeedList) {
                    productionFeedList.appendChild(feedJob);
                }
            });
            
            applyFilter();
            updateStatistics();
            alert('Sample jobs added to production feed!');
        });
    }
    
    // Setup export
    setupExcelExport();
});

// ============================================================
// DEBUG FUNCTIONS
// ============================================================
function debugMachine211() {
    console.log('=== Debugging Machine 211 ===');
    const timeline211 = document.getElementById('timeline-211');
    console.log('Timeline 211:', timeline211);
    
    if (timeline211) {
        const jobs = timeline211.querySelectorAll('.job');
        console.log('Jobs on Machine 211:', jobs.length);
        jobs.forEach((job, index) => {
            console.log(`Job ${index}:`, job.getAttribute('data-job-id'), job.style.backgroundColor, job.classList.contains('job-printed') ? '(Printed)' : '');
        });
    }
    console.log('=== End Debug ===');
}

function debugData() {
    console.log('=== Debug Data ===');
    console.log('jobDatabase:', Object.keys(jobDatabase).length, 'jobs');
    console.log('plDatabase:', Object.keys(plDatabase).length, 'jobs');
    console.log('awData:', Object.keys(awData).length, 'entries');
    console.log('jobSchedule:', Object.keys(jobSchedule).length, 'scheduled');
    console.log('jobSpeeds:', Object.keys(jobSpeeds).length, 'custom speeds');
    console.log('=== End Debug ===');
}



// ============================================================
// EXPOSE TO WINDOW FOR DEBUGGING
// ============================================================
window.jobDatabase = jobDatabase;
window.plDatabase = plDatabase;
window.awData = awData;
window.jobSchedule = jobSchedule;
window.machineConfig = machineConfig;
window.calculateJobDuration = calculateJobDuration;
window.rescheduleTimelineJobs = rescheduleTimelineJobs;
window.updateAllJobColors = updateAllJobColors;
window.updateStatistics = updateStatistics;
window.updateJobSpeed = updateJobSpeed;
window.updateJobSetup = updateJobSetup;
window.updateJobQuantity = updateJobQuantity;
window.updateJobStatus = updateJobStatus;
window.jobSpeeds = jobSpeeds;
window.smartZoomIn = smartZoomIn;
window.smartZoomOut = smartZoomOut;
window.smartResetZoom = smartResetZoom;
window.currentZoomLevel = currentZoomLevel;
window.debugMachine211 = debugMachine211;
window.debugData = debugData;
window.scaleTimeline = scaleTimeline;
window.populateProductionFeed = populateProductionFeed;
window.applyFilter = applyFilter;
window.updateCompletedJobs = updateCompletedJobs;
window.updateAllTimelineScrollPositions = updateAllTimelineScrollPositions;
window.exportPLData = exportPLData;


// ============================================================
// JOB DETAILS MODAL
// ============================================================
// ============================================================
// JOB DETAILS MODAL - COMPLETE WORKING VERSION
// ============================================================
let currentModalJobId = null;

// Initialize modal event listeners when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    setupModalEventListeners();
    setupModalClickTriggers();
});

// ============================================================
// JOB DETAILS MODAL - CLICK TRIGGERS
// ============================================================

// Use double-click to open modal (avoids conflicts with drag & drop and selection)
function setupModalClickTriggers() {
    console.log('Setting up modal click triggers...');
    
    // Double-click on feed jobs
    document.addEventListener('dblclick', function(e) {
        const feedJob = e.target.closest('.feed-job');
        if (feedJob) {
            const jobId = feedJob.getAttribute('data-job-id');
            if (jobId) {
                e.stopPropagation();
                console.log('Feed job double-clicked:', jobId);
                openJobDetailsModal(jobId);
            }
        }
    });
    
    // Double-click on timeline jobs
    document.addEventListener('dblclick', function(e) {
        const timelineJob = e.target.closest('.job');
        if (timelineJob) {
            // Don't open modal if clicking on inputs
            if (e.target.closest('input') || e.target.closest('button') || e.target.closest('select')) {
                return;
            }
            const jobId = timelineJob.getAttribute('data-job-id');
            if (jobId) {
                e.stopPropagation();
                console.log('Timeline job double-clicked:', jobId);
                openJobDetailsModal(jobId);
            }
        }
    });
    
    // Also support single-click with Ctrl/Cmd key for power users
    document.addEventListener('click', function(e) {
        if (e.ctrlKey || e.metaKey) {
            const feedJob = e.target.closest('.feed-job');
            if (feedJob) {
                const jobId = feedJob.getAttribute('data-job-id');
                if (jobId) {
                    e.stopPropagation();
                    console.log('Ctrl+Click feed job:', jobId);
                    openJobDetailsModal(jobId);
                }
            }
            
            const timelineJob = e.target.closest('.job');
            if (timelineJob) {
                if (e.target.closest('input') || e.target.closest('button') || e.target.closest('select')) {
                    return;
                }
                const jobId = timelineJob.getAttribute('data-job-id');
                if (jobId) {
                    e.stopPropagation();
                    console.log('Ctrl+Click timeline job:', jobId);
                    openJobDetailsModal(jobId);
                }
            }
        }
    });
}

// Also add a small instruction tooltip
function addModalInstructions() {
    const style = document.createElement('style');
    style.textContent = `
        .feed-job::after {
            content: " 🔍 Double-click to edit";
            font-size: 10px;
            color: #6c757d;
            opacity: 0;
            transition: opacity 0.3s;
            margin-left: 8px;
        }
        .feed-job:hover::after {
            opacity: 0.7;
        }
        .job::after {
            content: " 🔍";
            font-size: 12px;
            opacity: 0;
            transition: opacity 0.3s;
            margin-left: 4px;
        }
        .job:hover::after {
            opacity: 0.8;
        }
        .job-printed::after {
            display: none;
        }
    `;
    document.head.appendChild(style);
}

function openJobDetailsModal(jobId) {
    console.log('Opening modal for job:', jobId);
    
    // Find the element that was clicked (feed item or timeline job)
    const feedItem = document.querySelector(`.feed-job[data-job-id="${jobId}"]`);
    const timelineJob = document.querySelector(`.job[data-job-id="${jobId}"]`);
    
    if (!feedItem && !timelineJob) {
        showNotification(`❌ Job "${jobId}" not found`, 'error');
        return;
    }
    
    const jobData = jobDatabase[jobId];
    if (!jobData) {
        showNotification(`❌ Job data not found for "${jobId}"`, 'error');
        return;
    }
    
    currentModalJobId = jobId;
    const modal = document.getElementById('job-details-modal');
    if (!modal) {
        console.error('Modal element not found!');
        showNotification('❌ Modal not found in DOM', 'error');
        return;
    }
    
    const modalTitle = document.getElementById('modal-job-title');
    if (modalTitle) {
        modalTitle.innerHTML = `${jobData.name || 'Unnamed'} <span class="modal-job-id-badge">${jobData.jobNumber || jobId}</span>`;
    }
    
    // Populate basic fields
    const jobNumberInput = document.getElementById('modal-job-number');
    if (jobNumberInput) jobNumberInput.value = jobData.jobNumber || jobId;
    
    const nameInput = document.getElementById('modal-job-name');
    if (nameInput) nameInput.value = jobData.name || '';
    
    const setupInput = document.getElementById('modal-setup');
    if (setupInput) setupInput.value = jobData.setup || 120;
    
    const quantityInput = document.getElementById('modal-quantity');
    if (quantityInput) quantityInput.value = jobData.quantity || 0;
    
    // Speed
    const currentSpeed = jobSpeeds[jobId] || jobData.machineSpeed || machineConfig.speed;
    const speedInput = document.getElementById('modal-speed');
    if (speedInput) speedInput.value = currentSpeed;
    
    // Machine
    const machineSelect = document.getElementById('modal-machine');
    if (machineSelect) {
        const machineId = jobData.machine || '';
        // Check if job is on timeline to get machine
        if (timelineJob) {
            const timeline = timelineJob.closest('.timeline');
            if (timeline) {
                const timelineContainer = timeline.closest('.timeline-container');
                if (timelineContainer) {
                    const machineElement = timelineContainer.closest('.machine');
                    if (machineElement) {
                        const machineNumber = machineElement.getAttribute('data-machine-id');
                        if (machineNumber && machineIdMap[machineNumber]) {
                            machineSelect.value = machineIdMap[machineNumber];
                        }
                    }
                }
            }
        } else if (machineId) {
            machineSelect.value = machineId;
        } else {
            machineSelect.value = '';
        }
    }
    
    // Status fields
    const awStatus = jobData.rawAWStatus || jobData.awStatus || jobData.status || 'Missing Data';
    const awStatusSelect = document.getElementById('modal-aw-status');
    if (awStatusSelect) awStatusSelect.value = awStatus;
    
    const plStatus = jobData.planningStatus || 'Unprinted';
    const plStatusSelect = document.getElementById('modal-pl-status');
    if (plStatusSelect) plStatusSelect.value = plStatus;
    
    // Status date
    const statusDate = jobData.statusDate ? new Date(jobData.statusDate) : new Date();
    const dateInput = document.getElementById('modal-status-date');
    if (dateInput) {
        if (!isNaN(statusDate.getTime())) {
            const year = statusDate.getFullYear();
            const month = String(statusDate.getMonth() + 1).padStart(2, '0');
            const day = String(statusDate.getDate()).padStart(2, '0');
            const hours = String(statusDate.getHours()).padStart(2, '0');
            const minutes = String(statusDate.getMinutes()).padStart(2, '0');
            dateInput.value = `${year}-${month}-${day}T${hours}:${minutes}`;
        } else {
            dateInput.value = '';
        }
    }
    
    // Timeline info
    const isOnTimeline = !!timelineJob;
    const timelineBadge = document.getElementById('modal-on-timeline');
    if (timelineBadge) {
        if (isOnTimeline) {
            timelineBadge.textContent = 'Yes';
            timelineBadge.className = 'modal-badge badge-yes';
        } else {
            timelineBadge.textContent = 'No';
            timelineBadge.className = 'modal-badge badge-no';
        }
    }
    
    const removeBtn = document.getElementById('modal-remove-from-timeline');
    const addBtn = document.getElementById('modal-add-to-timeline');
    if (removeBtn) removeBtn.style.display = isOnTimeline ? 'inline-block' : 'none';
    if (addBtn) addBtn.style.display = isOnTimeline ? 'none' : 'inline-block';
    
    // Start and end times
    const startTimeEl = document.getElementById('modal-start-time');
    const endTimeEl = document.getElementById('modal-end-time');
    const durationEl = document.getElementById('modal-duration');
    
    if (jobSchedule[jobId]) {
        const startTime = new Date(jobSchedule[jobId].startTime);
        const endTime = new Date(jobSchedule[jobId].endTime);
        if (startTimeEl) startTimeEl.textContent = formatDateTime(startTime);
        if (endTimeEl) endTimeEl.textContent = formatDateTime(endTime);
        const duration = Math.round((endTime - startTime) / 60000);
        if (durationEl) durationEl.textContent = `${duration} minutes`;
    } else {
        if (startTimeEl) startTimeEl.textContent = 'Not scheduled';
        if (endTimeEl) endTimeEl.textContent = 'Not scheduled';
        if (durationEl) durationEl.textContent = 'N/A';
    }
    
    // Additional PL data
    const plData = plDatabase[jobId] || {};
    
    const fields = {
        'modal-new-plat': plData.newPlat || jobData.newPlat || '',
        'modal-material-availability': plData.materialAvailability || jobData.materialAvailability || '',
        'modal-delivered': plData.delivered || jobData.delivered || '',
        'modal-delivered2': plData.delivered2 || jobData.delivered2 || '',
        'modal-cutting-method': plData.cuttingMethod || jobData.cuttingMethod || '',
        'modal-film': plData.film || jobData.film || '',
        'modal-thickness': plData.thickness || jobData.thickness || '',
        'modal-material-type': plData.materialType || jobData.materialType || '',
        'modal-downtime': plData.downtime || jobData.downtime || 0
    };
    
    Object.keys(fields).forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = fields[id];
    });
    
    // Show modal
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
    
    // Highlight the selected job
    if (timelineJob) {
        timelineJob.classList.add('job-selected');
    } else if (feedItem) {
        feedItem.classList.add('feed-job-selected');
    }
}

function closeJobDetailsModal() {
    const modal = document.getElementById('job-details-modal');
    if (modal) modal.classList.remove('active');
    document.body.style.overflow = '';
    
    // Remove selection highlights
    document.querySelectorAll('.job-selected, .feed-job-selected').forEach(el => {
        el.classList.remove('job-selected', 'feed-job-selected');
    });
    
    currentModalJobId = null;
}

function saveJobDetailsFromModal() {
    if (!currentModalJobId) {
        showNotification('❌ No job selected', 'error');
        return;
    }
    
    const jobId = currentModalJobId;
    const jobData = jobDatabase[jobId];
    if (!jobData) {
        showNotification('❌ Job data not found', 'error');
        return;
    }
    
    // Collect values
    const nameInput = document.getElementById('modal-job-name');
    const setupInput = document.getElementById('modal-setup');
    const quantityInput = document.getElementById('modal-quantity');
    const speedInput = document.getElementById('modal-speed');
    const machineSelect = document.getElementById('modal-machine');
    const awStatusSelect = document.getElementById('modal-aw-status');
    const plStatusSelect = document.getElementById('modal-pl-status');
    const dateInput = document.getElementById('modal-status-date');
    
    const name = nameInput ? nameInput.value.trim() : '';
    const setup = parseFloat(setupInput ? setupInput.value : 0);
    const quantity = parseFloat(quantityInput ? quantityInput.value : 0);
    const speed = parseFloat(speedInput ? speedInput.value : 0);
    const machine = machineSelect ? machineSelect.value : '';
    const awStatus = awStatusSelect ? awStatusSelect.value : 'Missing Data';
    const plStatus = plStatusSelect ? plStatusSelect.value : 'Unprinted';
    const statusDateStr = dateInput ? dateInput.value : '';
    
    // Validate
    if (!name) {
        showNotification('⚠️ Job name is required', 'warning');
        return;
    }
    if (isNaN(setup) || setup < 0) {
        showNotification('⚠️ Please enter a valid setup time', 'warning');
        return;
    }
    if (isNaN(quantity) || quantity < 0) {
        showNotification('⚠️ Please enter a valid quantity', 'warning');
        return;
    }
    if (isNaN(speed) || speed <= 0) {
        showNotification('⚠️ Please enter a valid speed', 'warning');
        return;
    }
    
    // Status date
    let statusDate = new Date();
    if (statusDateStr) {
        const parsed = new Date(statusDateStr);
        if (!isNaN(parsed.getTime()) && parsed.getFullYear() > 1900) {
            statusDate = parsed;
        }
    }
    
    // Check if job is on timeline
    const timelineJob = document.querySelector(`.job[data-job-id="${jobId}"]`);
    const isOnTimeline = !!timelineJob;
    
    // Update job database
    jobData.name = name;
    jobData.setup = setup;
    jobData.quantity = quantity;
    jobData.awStatus = awStatus;
    jobData.rawAWStatus = awStatus;
    jobData.status = awStatus;
    jobData.planningStatus = plStatus;
    jobData.statusDate = statusDate.toISOString();
    jobData.machine = machine;
    
    // Update PL database
    if (plDatabase[jobId]) {
        plDatabase[jobId].jobName = name;
        plDatabase[jobId].setupTime = setup;
        plDatabase[jobId].meters = quantity;
        plDatabase[jobId].prepressStatus = awStatus;
        plDatabase[jobId].planningStatus = plStatus;
        plDatabase[jobId].statusDate = statusDate.toISOString();
        plDatabase[jobId].machine = machine;
    }
    
    // Collect additional PL data
    const additionalFields = {
        newPlat: document.getElementById('modal-new-plat')?.value || '',
        materialAvailability: document.getElementById('modal-material-availability')?.value || '',
        delivered: document.getElementById('modal-delivered')?.value || '',
        delivered2: document.getElementById('modal-delivered2')?.value || '',
        cuttingMethod: document.getElementById('modal-cutting-method')?.value || '',
        film: document.getElementById('modal-film')?.value || '',
        thickness: document.getElementById('modal-thickness')?.value || '',
        materialType: document.getElementById('modal-material-type')?.value || '',
        downtime: parseFloat(document.getElementById('modal-downtime')?.value) || 0
    };
    
    Object.assign(jobData, additionalFields);
    if (plDatabase[jobId]) {
        Object.assign(plDatabase[jobId], additionalFields);
    }
    
    // Update speed
    jobSpeeds[jobId] = speed;
    if (plDatabase[jobId]) {
        plDatabase[jobId].machineSpeed = speed;
        plDatabase[jobId].plannedSpeed = speed;
        plDatabase[jobId].actualSpeed = speed;
    }
    
    // Handle machine assignment
    if (isOnTimeline && machine) {
        const currentTimeline = timelineJob.parentElement;
        const targetTimelineId = `timeline-${machine}`;
        const targetTimeline = document.getElementById(targetTimelineId);
        
        if (targetTimeline && currentTimeline && currentTimeline.id !== targetTimelineId) {
            // Move job to new machine
            timelineJob.remove();
            const printedJobs = targetTimeline.querySelectorAll('.job.job-printed');
            if (printedJobs.length > 0) {
                targetTimeline.insertBefore(timelineJob, printedJobs[0]);
            } else {
                targetTimeline.appendChild(timelineJob);
            }
            
            if (jobSchedule[jobId]) {
                jobSchedule[jobId].timelineId = targetTimelineId;
            }
            
            rescheduleTimelineJobs(currentTimeline.id);
            rescheduleTimelineJobs(targetTimelineId);
            scaleTimeline(currentTimeline.id);
            scaleTimeline(targetTimelineId);
            updateMachineStatus(currentTimeline.closest('.machine'));
            updateMachineStatus(targetTimeline.closest('.machine'));
            updateAllJobTimes();
            updateAllJobColors();
        }
    } else if (!isOnTimeline && machine) {
        // Job is not on timeline but has a machine assigned - add it if PL status is Planned
        if (plStatus === 'Planned') {
            const targetTimelineId = `timeline-${machine}`;
            const targetTimeline = document.getElementById(targetTimelineId);
            if (targetTimeline) {
                const existingJob = document.querySelector(`.job[data-job-id="${jobId}"]`);
                if (!existingJob) {
                    const now = new Date().getTime();
                    addJobToTimelineWithSchedule(jobId, targetTimelineId, now);
                    showNotification(`✅ "${name}" added to timeline`, 'success');
                }
            }
        }
    } else if (isOnTimeline && plStatus !== 'Planned' && plStatus !== 'Complete') {
        // If job is on timeline but PL status is not Planned or Complete, remove it
        if (!timelineJob.classList.contains('job-printed')) {
            const feedItem = document.querySelector(`.feed-job[data-job-id="${jobId}"]`);
            if (!feedItem) {
                returnJobToFeed(timelineJob);
                showNotification(`↩️ "${name}" removed from timeline (status: ${plStatus})`, 'info');
            }
        }
    }
    
    // Update UI elements
    // Update feed item
    const feedItem = document.querySelector(`.feed-job[data-job-id="${jobId}"]`);
    if (feedItem) {
        const newFeedItem = createFeedJobElement(jobId, jobData);
        feedItem.parentNode.replaceChild(newFeedItem, feedItem);
    }
    
    // Update timeline job
    const updatedTimelineJob = document.querySelector(`.job[data-job-id="${jobId}"]`);
    if (updatedTimelineJob) {
        const newTimelineJob = createJobElement(jobId, jobData);
        updatedTimelineJob.parentNode.replaceChild(newTimelineJob, updatedTimelineJob);
        
        // Reapply schedule
        if (jobSchedule[jobId]) {
            const newJob = document.querySelector(`.job[data-job-id="${jobId}"]`);
            if (newJob) {
                const timeElement = newJob.querySelector('.job-time');
                if (timeElement) {
                    const start = new Date(jobSchedule[jobId].startTime);
                    const end = new Date(jobSchedule[jobId].endTime);
                    timeElement.textContent = `${formatTime(start)} - ${formatTime(end)}`;
                }
            }
        }
    }
    
    // Update filter and statistics
    applyFilter();
    updateStatistics();
    updateAllJobColors();
    updateAllJobTimes();
    applySmartZoom();
    setTimeout(() => updateAllTimelineScrollPositions(), 300);
    
    showNotification(`✅ "${name}" updated successfully`, 'success');
    closeJobDetailsModal();
}

function addJobToTimelineFromModal() {
    if (!currentModalJobId) {
        showNotification('❌ No job selected', 'error');
        return;
    }
    
    const jobId = currentModalJobId;
    const jobData = jobDatabase[jobId];
    if (!jobData) {
        showNotification('❌ Job data not found', 'error');
        return;
    }
    
    // Check if already on timeline
    if (document.querySelector(`.job[data-job-id="${jobId}"]`)) {
        showNotification('⚠️ Job is already on the timeline', 'warning');
        return;
    }
    
    // Get machine from modal
    const machineSelect = document.getElementById('modal-machine');
    const machine = machineSelect ? machineSelect.value : '';
    if (!machine) {
        showNotification('⚠️ Please assign a machine first', 'warning');
        return;
    }
    
    // Update PL status to Planned
    const plStatusSelect = document.getElementById('modal-pl-status');
    if (plStatusSelect) plStatusSelect.value = 'Planned';
    jobData.planningStatus = 'Planned';
    
    const timelineId = `timeline-${machine}`;
    const timeline = document.getElementById(timelineId);
    if (!timeline) {
        showNotification(`❌ Machine ${machine} not found`, 'error');
        return;
    }
    
    const now = new Date().getTime();
    addJobToTimelineWithSchedule(jobId, timelineId, now);
    
    // Update modal
    const timelineBadge = document.getElementById('modal-on-timeline');
    if (timelineBadge) {
        timelineBadge.textContent = 'Yes';
        timelineBadge.className = 'modal-badge badge-yes';
    }
    
    const removeBtn = document.getElementById('modal-remove-from-timeline');
    const addBtn = document.getElementById('modal-add-to-timeline');
    if (removeBtn) removeBtn.style.display = 'inline-block';
    if (addBtn) addBtn.style.display = 'none';
    
    // Update times in modal
    if (jobSchedule[jobId]) {
        const startTime = new Date(jobSchedule[jobId].startTime);
        const endTime = new Date(jobSchedule[jobId].endTime);
        const startTimeEl = document.getElementById('modal-start-time');
        const endTimeEl = document.getElementById('modal-end-time');
        const durationEl = document.getElementById('modal-duration');
        if (startTimeEl) startTimeEl.textContent = formatDateTime(startTime);
        if (endTimeEl) endTimeEl.textContent = formatDateTime(endTime);
        const duration = Math.round((endTime - startTime) / 60000);
        if (durationEl) durationEl.textContent = `${duration} minutes`;
    }
    
    // Update feed item
    const feedItem = document.querySelector(`.feed-job[data-job-id="${jobId}"]`);
    if (feedItem) {
        const newFeedItem = createFeedJobElement(jobId, jobData);
        feedItem.parentNode.replaceChild(newFeedItem, feedItem);
    }
    
    showNotification(`✅ "${jobData.name}" added to Machine ${machine}`, 'success');
    applyFilter();
    updateStatistics();
    updateAllJobColors();
    applySmartZoom();
    setTimeout(() => updateAllTimelineScrollPositions(), 300);
}

function removeJobFromTimelineFromModal() {
    if (!currentModalJobId) {
        showNotification('❌ No job selected', 'error');
        return;
    }
    
    const jobId = currentModalJobId;
    const jobData = jobDatabase[jobId];
    if (!jobData) {
        showNotification('❌ Job data not found', 'error');
        return;
    }
    
    const timelineJob = document.querySelector(`.job[data-job-id="${jobId}"]`);
    if (!timelineJob) {
        showNotification('⚠️ Job is not on the timeline', 'warning');
        return;
    }
    
    if (timelineJob.classList.contains('job-printed')) {
        showNotification('⚠️ Cannot remove a completed/printed job', 'warning');
        return;
    }
    
    // Update PL status to Unprinted
    const plStatusSelect = document.getElementById('modal-pl-status');
    if (plStatusSelect) plStatusSelect.value = 'Unprinted';
    jobData.planningStatus = 'Unprinted';
    
    returnJobToFeed(timelineJob);
    
    // Update modal
    const timelineBadge = document.getElementById('modal-on-timeline');
    if (timelineBadge) {
        timelineBadge.textContent = 'No';
        timelineBadge.className = 'modal-badge badge-no';
    }
    
    const removeBtn = document.getElementById('modal-remove-from-timeline');
    const addBtn = document.getElementById('modal-add-to-timeline');
    if (removeBtn) removeBtn.style.display = 'none';
    if (addBtn) addBtn.style.display = 'inline-block';
    
    const startTimeEl = document.getElementById('modal-start-time');
    const endTimeEl = document.getElementById('modal-end-time');
    const durationEl = document.getElementById('modal-duration');
    if (startTimeEl) startTimeEl.textContent = 'Not scheduled';
    if (endTimeEl) endTimeEl.textContent = 'Not scheduled';
    if (durationEl) durationEl.textContent = 'N/A';
    
    // Update feed item
    const feedItem = document.querySelector(`.feed-job[data-job-id="${jobId}"]`);
    if (feedItem) {
        const newFeedItem = createFeedJobElement(jobId, jobData);
        feedItem.parentNode.replaceChild(newFeedItem, feedItem);
    }
    
    showNotification(`↩️ "${jobData.name}" removed from timeline`, 'info');
    applyFilter();
    updateStatistics();
    updateAllJobColors();
    applySmartZoom();
    setTimeout(() => updateAllTimelineScrollPositions(), 300);
}

// ============================================================
// MODAL EVENT LISTENERS SETUP
// ============================================================
function setupModalEventListeners() {
    console.log('Setting up modal event listeners...');
    
    // Close button
    const closeBtn = document.getElementById('modal-close-btn');
    if (closeBtn) {
        closeBtn.addEventListener('click', closeJobDetailsModal);
    }
    
    // Cancel button
    const cancelBtn = document.getElementById('modal-cancel-btn');
    if (cancelBtn) {
        cancelBtn.addEventListener('click', closeJobDetailsModal);
    }
    
    // Save button
    const saveBtn = document.getElementById('modal-save-btn');
    if (saveBtn) {
        saveBtn.addEventListener('click', saveJobDetailsFromModal);
    }
    
    // Add to timeline button
    const addBtn = document.getElementById('modal-add-to-timeline');
    if (addBtn) {
        addBtn.addEventListener('click', addJobToTimelineFromModal);
    }
    
    // Remove from timeline button
    const removeBtn = document.getElementById('modal-remove-from-timeline');
    if (removeBtn) {
        removeBtn.addEventListener('click', removeJobFromTimelineFromModal);
    }
    
    // Close on backdrop click
    const modal = document.getElementById('job-details-modal');
    if (modal) {
        modal.addEventListener('click', function(e) {
            if (e.target === this) {
                closeJobDetailsModal();
            }
        });
    }
    
    // Close on Escape key
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            const modal = document.getElementById('job-details-modal');
            if (modal && modal.classList.contains('active')) {
                closeJobDetailsModal();
            }
        }
    });
}

// Add CSS for feed-job-selected (to match job-selected)
const styleForModal = document.createElement('style');
styleForModal.textContent = `
    .feed-job-selected {
        background: linear-gradient(135deg, #e3f2fd, #bbdefb) !important;
        border-left: 4px solid #1976d2 !important;
        box-shadow: 0 2px 12px rgba(25, 118, 210, 0.2) !important;
    }
`;
document.head.appendChild(styleForModal);

// ============================================================
// END OF MODAL CODE
// ============================================================

// ============================================================
// CONSOLE HELP
// ============================================================
console.log('%c=== Planning Monitor Loaded ===', 'font-size:16px;font-weight:bold;color:#3498db;');
console.log('Available functions:');
console.log('  - smartZoomIn()          : Zoom in');
console.log('  - smartZoomOut()         : Zoom out');
console.log('  - smartResetZoom()       : Reset zoom');
console.log('  - debugMachine211()      : Debug Machine 211');
console.log('  - debugData()            : Show data statistics');
console.log('  - updateStatistics()     : Refresh stats');
console.log('  - scaleTimeline(id)      : Recalculate job widths');
console.log('  - applyFilter()          : Apply status filter');
console.log('  - updateCompletedJobs()  : Check and mark completed jobs');
console.log('  - updateAllTimelineScrollPositions() : Auto-scroll timelines');
console.log('  - exportPLData()         : Export PL data to Excel');
console.log('Keyboard shortcuts:');
console.log('  - Ctrl + +/-            : Zoom in/out');
console.log('  - Ctrl + 0              : Reset zoom');
console.log('  - Delete                : Remove selected job');
console.log('Upload buttons:');
console.log('  - Upload AW: Updates job statuses from AW file (overwrites AW data)');
console.log('  - Upload PL: Updates/creates jobs from PL file (preserves timelines)');
console.log('  - Export PL: Downloads current data as "Downloaded Planning.xlsx"');
console.log('%c===================================', 'font-size:16px;font-weight:bold;color:#3498db;');
