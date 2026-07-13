// script-feed.js
// ============================================================
// PRODUCTION FEED & JOB MANAGEMENT FUNCTIONS
// ============================================================

// ============================================================
// JOB DATA STORAGE
// ============================================================
const jobDatabase = {};
const plDatabase = {};
let awData = {};

// Status color mapping
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
    'Deleted': '#dc3545',
    'On Hold': '#ffc107',
    'Printed': '#2c3e50',
    'Complete': '#2c3e50',
    'Unprinted': '#fd7e14',
    'Planned': '#17a2b8',
    'PL-Deleted': '#c0392b',
    'PL-Hold': '#e67e22'
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
    'Deleted': 'Deleted',
    'On Hold': 'On Hold',
    'Printed': 'Printed',
    'Complete': 'Complete',
    'Unprinted': 'Unprinted',
    'Planned': 'Planned',
    'PL-Deleted': 'Deleted',
    'PL-Hold': 'Hold'
};

const AW_STATUSES = [
    'Missing Data', 'Unknown', '1. Under Job-Study', '2. Under QC Check',
    '3. S.C Approval', '4. Need S.C Approval', '5. Working on Cromalin',
    '6. Need Cromalin Approval', '7. Cromalin Approval',
    '8. Repro: Plate Making', '9. Plates are Ready', 'Deleted', 'On Hold'
];

const PL_STATUSES = ['Complete', 'Planned', 'Unprinted', 'PL-Deleted', 'PL-Hold'];

const ALL_STATUSES = [...AW_STATUSES, ...PL_STATUSES];

let filterStatuses = new Set();

AW_STATUSES.forEach(status => {
    if (status !== 'Missing Data' && status !== 'Unknown' && status !== 'Deleted' && status !== 'On Hold') {
        filterStatuses.add(status);
    }
});

PL_STATUSES.forEach(status => {
    if (status === 'Planned' || status === 'Unprinted') {
        filterStatuses.add(status);
    }
});

// ============================================================
// NOTIFICATION SYSTEM
// ============================================================
let notificationTimeout = null;

function showNotification(message, type = 'info') {
    const existingNotification = document.querySelector('.notification-toast');
    if (existingNotification) existingNotification.remove();
    if (notificationTimeout) {
        clearTimeout(notificationTimeout);
        notificationTimeout = null;
    }
    
    const notification = document.createElement('div');
    notification.className = `notification-toast notification-${type}`;
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
    
    const closeBtn = notification.querySelector('.notification-close');
    closeBtn.addEventListener('click', function() {
        notification.classList.remove('notification-show');
        setTimeout(() => notification.remove(), 300);
    });
    
    document.body.appendChild(notification);
    setTimeout(() => notification.classList.add('notification-show'), 10);
    
    notificationTimeout = setTimeout(() => {
        notification.classList.remove('notification-show');
        setTimeout(() => notification.remove(), 300);
        notificationTimeout = null;
    }, 4000);
}

// ============================================================
// FORMAT DATE TIME
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

function formatTime(date) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
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
    
    const awStatus = jobData.awStatus || jobData.status || 'Missing Data';
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
    
    // Merge AW status with date
    const awDisplayText = `AW: ${statusDisplay} since: ${statusDateFormatted}`;
    
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
    const showEstimated = awStatus === '8. Repro: Plate Making' || awStatus === '5. Working on Cromalin';
    
    job.innerHTML = `
        <div class="job-name">
            <span class="job-number-badge">${jobNumber}</span>
            ${jobData.name}
        </div>
        <div class="job-details">
            <div class="job-duration">${duration} min</div>
            <div class="job-breakdown">
                <span class="job-status-badge" style="color:${statusColor}">${awDisplayText}</span>
                ${showEstimated && estimatedDisplayText ? 
                    `<span class="job-estimated-date" style="color:${statusColor}; background-color:${statusColor}15; border-color:${statusColor}40; font-size:8px; padding:1px 4px; border-radius:3px; border:1px solid;">
                        ${estimatedDisplayText}
                    </span>` : ''
                }
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
    
    // Setup input event listeners (unchanged)
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
            estimatedDisplayText = `AW: Est: ${estimatedDateFormatted}`;
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
// FORMAT DATE ONLY - "08/03/2026"
// ============================================================
function formatDateOnly(date) {
    if (!date || isNaN(date.getTime())) return '01/01/1900';
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
}

// ============================================================
// PRODUCTION FEED
// ============================================================

function populateProductionFeed() {
    const productionFeedList = document.getElementById('production-feed-list');
    if (!productionFeedList) return;
    
    productionFeedList.innerHTML = '';
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
    updateFilterCounts();
    updateStatistics();
}

// ============================================================
// STATISTICS
// ============================================================

function updateStatistics() {
    const allFeedItems = document.querySelectorAll('.feed-job');
    const visibleFeedItems = document.querySelectorAll('.feed-job:not(.filter-hidden)');
    const timelineJobs = document.querySelectorAll('.job:not(.job-printed)').length;
    
    const plannedJobsElement = document.querySelector('.stat-card:nth-child(1) .stat-value');
    const pendingJobsElement = document.querySelector('.stat-card:nth-child(2) .stat-value');
    
    if (plannedJobsElement) plannedJobsElement.textContent = timelineJobs;
    if (pendingJobsElement) pendingJobsElement.textContent = visibleFeedItems.length;
    
    const feedCountElement = document.querySelector('.feed-count');
    if (feedCountElement) feedCountElement.textContent = `${allFeedItems.length} jobs`;
    
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

// ============================================================
// FILTER FUNCTIONALITY
// ============================================================

function toggleFilterPanel() {
    let filterPanel = document.getElementById('filter-panel');
    if (filterPanel) {
        filterPanel.classList.toggle('active');
        return;
    }
    
    filterPanel = document.createElement('div');
    filterPanel.id = 'filter-panel';
    filterPanel.className = 'filter-panel';
    
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
    
    // AW Section
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
            if (this.checked) filterStatuses.add(status);
            else filterStatuses.delete(status);
            applyFilter();
            updateStatistics();
        });
    });
    filterPanel.appendChild(awList);
    
    const divider = document.createElement('hr');
    divider.style.cssText = 'margin: 10px 0; border: none; border-top: 1px solid #e9ecef;';
    filterPanel.appendChild(divider);
    
    // PL Section
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
        const displayName = statusDisplayMap[status] || status;
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
            if (this.checked) filterStatuses.add(status);
            else filterStatuses.delete(status);
            applyFilter();
            updateStatistics();
        });
    });
    filterPanel.appendChild(plList);
    
    const feedControls = document.querySelector('.feed-controls');
    if (feedControls) {
        feedControls.parentNode.insertBefore(filterPanel, feedControls.nextSibling);
    }
    
    document.getElementById('aw-select-all').addEventListener('click', function(e) {
        e.stopPropagation();
        AW_STATUSES.forEach(status => filterStatuses.add(status));
        awList.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = true);
        applyFilter();
        updateStatistics();
    });
    
    document.getElementById('aw-clear-all').addEventListener('click', function(e) {
        e.stopPropagation();
        AW_STATUSES.forEach(status => filterStatuses.delete(status));
        awList.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false);
        applyFilter();
        updateStatistics();
    });
    
    document.getElementById('pl-select-all').addEventListener('click', function(e) {
        e.stopPropagation();
        PL_STATUSES.forEach(status => filterStatuses.add(status));
        plList.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = true);
        applyFilter();
        updateStatistics();
    });
    
    document.getElementById('pl-clear-all').addEventListener('click', function(e) {
        e.stopPropagation();
        PL_STATUSES.forEach(status => filterStatuses.delete(status));
        plList.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false);
        applyFilter();
        updateStatistics();
    });
    
    document.getElementById('reset-default-filter').addEventListener('click', function(e) {
        e.stopPropagation();
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
        });
        filterPanel.querySelectorAll('input[type="checkbox"]').forEach(cb => {
            cb.checked = filterStatuses.has(cb.value);
        });
        applyFilter();
        updateStatistics();
    });
    
    document.getElementById('select-all-statuses').addEventListener('click', function(e) {
        e.stopPropagation();
        ALL_STATUSES.forEach(status => filterStatuses.add(status));
        filterPanel.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = true);
        applyFilter();
        updateStatistics();
    });
    
    document.getElementById('clear-all-statuses').addEventListener('click', function(e) {
        e.stopPropagation();
        filterStatuses = new Set();
        filterPanel.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false);
        applyFilter();
        updateStatistics();
    });
    
    setTimeout(() => updateFilterCounts(), 100);
    filterPanel.classList.add('active');
}

function applyFilter() {
    const feedItems = document.querySelectorAll('.feed-job');
    let visibleCount = 0;
    
    const awFilterStatuses = new Set();
    const plFilterStatuses = new Set();
    
    filterStatuses.forEach(status => {
        if (AW_STATUSES.includes(status)) awFilterStatuses.add(status);
        if (PL_STATUSES.includes(status)) plFilterStatuses.add(status);
    });
    
    const hasAWFilter = awFilterStatuses.size > 0;
    const hasPLFilter = plFilterStatuses.size > 0;
    const showAll = !hasAWFilter && !hasPLFilter;
    
    feedItems.forEach(item => {
        if (showAll) {
            item.classList.remove('filter-hidden');
            visibleCount++;
            return;
        }
        
        const statusElement = item.querySelector('.feed-status');
        let awStatus = '';
        if (statusElement) {
            awStatus = statusElement.getAttribute('data-raw-status') || '';
            if (!awStatus) {
                const text = statusElement.textContent.trim();
                const match = text.match(/AW:\s*(.+)/);
                if (match) awStatus = match[1].trim();
                else awStatus = text.trim();
            }
        }
        
        const plStatusElement = item.querySelector('.feed-pl-status');
        let plStatus = '';
        if (plStatusElement) {
            plStatus = plStatusElement.getAttribute('data-raw-pl-status') || '';
            if (!plStatus) {
                const plText = plStatusElement.textContent.trim();
                const match = plText.match(/PL:\s*(.+)/);
                if (match) plStatus = match[1].trim();
            }
        }
        
        let awMatched = null;
        if (awStatus) {
            awMatched = AW_STATUSES.find(s => statusDisplayMap[s] === awStatus || s === awStatus);
            if (!awMatched) {
                const isPLStatus = PL_STATUSES.some(s => statusDisplayMap[s] === awStatus || s === awStatus);
                if (isPLStatus || awStatus === '' || awStatus === 'Pending') awMatched = 'Unknown';
                else awMatched = 'Unknown';
            }
        } else {
            awMatched = 'Unknown';
        }
        
        let plMatched = null;
        if (plStatus) {
            if (plStatus === 'Deleted') plMatched = 'PL-Deleted';
            else if (plStatus === 'Hold') plMatched = 'PL-Hold';
            else {
                plMatched = PL_STATUSES.find(s => s === plStatus);
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
        if (!plMatched) plMatched = 'Unprinted';
        
        let awVisible = true;
        if (hasAWFilter) awVisible = awFilterStatuses.has(awMatched);
        
        let plVisible = true;
        if (hasPLFilter) plVisible = plFilterStatuses.has(plMatched);
        
        if (awVisible && plVisible) {
            item.classList.remove('filter-hidden');
            visibleCount++;
        } else {
            item.classList.add('filter-hidden');
        }
    });
    
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
    
    updateFilterCounts();
    updateStatistics();
}

function updateFilterCounts() {
    const allFeedItems = document.querySelectorAll('.feed-job');
    const counts = {};
    ALL_STATUSES.forEach(s => counts[s] = 0);
    
    allFeedItems.forEach(item => {
        const statusElement = item.querySelector('.feed-status');
        let awStatus = '';
        if (statusElement) {
            awStatus = statusElement.getAttribute('data-raw-status') || '';
            if (!awStatus) {
                const text = statusElement.textContent.trim();
                const match = text.match(/AW:\s*(.+)/);
                if (match) awStatus = match[1].trim();
                else awStatus = text.trim();
            }
        }
        
        const plStatusElement = item.querySelector('.feed-pl-status');
        let plStatus = '';
        if (plStatusElement) {
            plStatus = plStatusElement.getAttribute('data-raw-pl-status') || '';
            if (!plStatus) {
                const plText = plStatusElement.textContent.trim();
                const match = plText.match(/PL:\s*(.+)/);
                if (match) plStatus = match[1].trim();
            }
        }
        
        const jobId = item.getAttribute('data-job-id');
        const jobData = jobDatabase[jobId];
        let rawAWStatus = awStatus;
        if (jobData && jobData.rawAWStatus !== undefined) rawAWStatus = jobData.rawAWStatus;
        
        let awMatched = null;
        if (rawAWStatus) {
            if (rawAWStatus === 'Missing Data') awMatched = 'Missing Data';
            else if (AW_STATUSES.includes(rawAWStatus)) awMatched = rawAWStatus;
            else awMatched = AW_STATUSES.find(s => statusDisplayMap[s] === rawAWStatus);
        }
        if (!awMatched) {
            if (!rawAWStatus || rawAWStatus === '' || rawAWStatus === 'Pending' || rawAWStatus === 'Unknown') {
                awMatched = 'Unknown';
            } else {
                const isPLStatus = PL_STATUSES.some(s => statusDisplayMap[s] === rawAWStatus || s === rawAWStatus);
                if (isPLStatus) awMatched = 'Unknown';
                else awMatched = 'Unknown';
            }
        }
        if (awMatched) counts[awMatched] = (counts[awMatched] || 0) + 1;
        
        if (plStatus) {
            let plMatched = null;
            if (plStatus === 'Deleted') plMatched = 'PL-Deleted';
            else if (plStatus === 'Hold') plMatched = 'PL-Hold';
            else {
                plMatched = PL_STATUSES.find(s => s === plStatus);
                if (!plMatched) {
                    for (const [key, value] of Object.entries(statusDisplayMap)) {
                        if (value === plStatus && PL_STATUSES.includes(key)) {
                            plMatched = key;
                            break;
                        }
                    }
                }
            }
            if (plMatched) counts[plMatched] = (counts[plMatched] || 0) + 1;
        }
    });
    
    ALL_STATUSES.forEach(status => {
        const badgeId = `count-${status.replace(/\s/g, '-')}`;
        const badge = document.getElementById(badgeId);
        if (badge) badge.textContent = counts[status] || 0;
    });
    
    const totalJobsElement = document.querySelector('.feed-header .feed-count');
    if (totalJobsElement) totalJobsElement.textContent = `${allFeedItems.length} jobs`;
}

// ============================================================
// JOB UPDATE FUNCTIONS
// ============================================================

function updateJobSetup(jobId, newSetup) {
    const setup = parseFloat(newSetup);
    if (isNaN(setup) || setup < 0) return false;
    
    if (jobDatabase[jobId]) {
        jobDatabase[jobId].setup = setup;
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
        if (plDatabase[jobId]) plDatabase[jobId].meters = quantity;
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
        if (plDatabase[jobId]) plDatabase[jobId].planningStatus = newStatus;
        const jobElement = document.querySelector(`.job[data-job-id="${jobId}"]`);
        if (jobElement) {
            const statusBadge = jobElement.querySelector('.job-status-badge');
            if (statusBadge) {
                statusBadge.textContent = statusDisplayMap[newStatus] || newStatus;
                statusBadge.style.color = statusColorMap[newStatus] || '#6c757d';
            }
        }
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

function updateJobPLStatus(jobId, newPLStatus) {
    if (!jobDatabase[jobId]) return false;
    
    const validPLStatuses = ['Planned', 'Unprinted', 'Complete', 'PL-Deleted', 'PL-Hold'];
    const statusMap = {
        'Planned': 'Planned', 'Unprinted': 'Unprinted', 'Complete': 'Complete',
        'Deleted': 'PL-Deleted', 'Hold': 'PL-Hold'
    };
    
    const mappedStatus = statusMap[newPLStatus] || newPLStatus;
    if (!validPLStatuses.includes(mappedStatus)) {
        console.warn(`Invalid PL status: ${newPLStatus}. Using 'Unprinted' as fallback.`);
        return updateJobPLStatus(jobId, 'Unprinted');
    }
    
    const finalStatus = mappedStatus;
    jobDatabase[jobId].planningStatus = finalStatus;
    if (plDatabase[jobId]) plDatabase[jobId].planningStatus = finalStatus;
    
    const feedItem = document.querySelector(`.feed-job[data-job-id="${jobId}"]`);
    if (feedItem) {
        const plStatusElement = feedItem.querySelector('.feed-pl-status');
        if (plStatusElement) {
            const displayName = statusDisplayMap[finalStatus] || finalStatus;
            const plStatusColor = statusColorMap[finalStatus] || '#6c757d';
            plStatusElement.setAttribute('data-raw-pl-status', finalStatus);
            plStatusElement.textContent = `PL: ${displayName}`;
            plStatusElement.style.backgroundColor = `${plStatusColor}20`;
            plStatusElement.style.color = plStatusColor;
            plStatusElement.style.border = `1px solid ${plStatusColor}40`;
        }
    }
    
    applyFilter();
    updateStatistics();
    console.log(`Updated PL status for ${jobId} to: ${finalStatus}`);
    return true;
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
// SELECTION
// ============================================================

function selectJob(jobElement) {
    if (selectedJob) selectedJob.classList.remove('job-selected');
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
    
    if (!jobName) { alert('Please enter a job name'); return; }
    if (isNaN(setupTime) || setupTime <= 0) { alert('Please enter a valid setup time'); return; }
    if (isNaN(quantity) || quantity <= 0) { alert('Please enter a valid quantity'); return; }
    
    const jobId = 'job-' + (Object.keys(jobDatabase).length + 1);
    jobDatabase[jobId] = {
        name: jobName, setup: setupTime, quantity: quantity,
        status: 'Missing Data', awStatus: 'Missing Data',
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
        job.style.display = (jobName.includes(searchTerm) || jobNumber.includes(searchTerm)) ? 'flex' : 'none';
    });
}

// ============================================================
// TIME FUNCTIONS
// ============================================================

function updateTime() {
    const now = new Date();
    const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const currentTimeElement = document.getElementById('current-time');
    if (currentTimeElement) currentTimeElement.textContent = timeString;
    updateAllJobTimes();
    updateCompletedJobs();
}

// ============================================================
// UPDATE JOB TIME DISPLAY - Show time only once
// ============================================================

function updateJobTimeDisplay(jobId) {
    const jobElement = document.querySelector(`.job[data-job-id="${jobId}"]`);
    if (!jobElement || !jobSchedule[jobId]) return;
    
    const schedule = jobSchedule[jobId];
    const startTime = new Date(schedule.startTime);
    const endTime = new Date(schedule.endTime);
    
    // Show the time range in the .job-time element only
    const timeElement = jobElement.querySelector('.job-time');
    if (timeElement) {
        const duration = (endTime - startTime) / (60 * 60 * 1000);
        if (duration >= 6) {
            // Show full date for long jobs
            timeElement.textContent = `${formatDateTime(startTime)} → ${formatDateTime(endTime)}`;
        } else {
            timeElement.textContent = `${formatTime(startTime)} → ${formatTime(endTime)}`;
        }
    }
    
    // Remove the duplicate .job-time-range if it exists
    const timeRange = jobElement.querySelector('.job-time-range');
    if (timeRange) {
        timeRange.remove();
    }
    
    jobElement.dataset.startTime = schedule.startTime;
    jobElement.dataset.endTime = schedule.endTime;
    
    const timeline = jobElement.closest('.timeline');
    if (timeline) {
        const container = timeline.closest('.timeline-container');
        if (container) {
            container.querySelectorAll('.timeline-ruler, .timeline-date-header').forEach(el => el.remove());
            timeline.querySelectorAll('.hour-grid-line').forEach(el => el.remove());
            scaleTimeline(timeline.id);
        }
    }
}

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

// ============================================================
// EXPOSE FUNCTIONS TO WINDOW
// ============================================================
window.jobDatabase = jobDatabase;
window.plDatabase = plDatabase;
window.awData = awData;
window.updateStatistics = updateStatistics;
window.updateJobSpeed = updateJobSpeed;
window.updateJobSetup = updateJobSetup;
window.updateJobQuantity = updateJobQuantity;
window.updateJobStatus = updateJobStatus;
window.updateJobPLStatus = updateJobPLStatus;
window.populateProductionFeed = populateProductionFeed;
window.applyFilter = applyFilter;
window.updateFilterCounts = updateFilterCounts;
window.showNotification = showNotification;
window.formatDateTime = formatDateTime;
window.formatTime = formatTime;
window.createFeedJobElement = createFeedJobElement;
window.createJobElement = createJobElement;
window.handleAddJob = handleAddJob;
window.handleSearch = handleSearch;
window.updateTime = updateTime;
window.updateJobTimeDisplay = updateJobTimeDisplay;
window.updateAllJobTimes = updateAllJobTimes;
