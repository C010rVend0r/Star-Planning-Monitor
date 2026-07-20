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
    'Unplanned': '#fd7e14',
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
    'Unplanned': 'Unplanned',
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

const PL_STATUSES = ['Complete', 'Planned', 'Unplanned', 'PL-Deleted', 'PL-Hold'];

const ALL_STATUSES = [...AW_STATUSES, ...PL_STATUSES];

let isUpdatingJobTimes = false;
let jobTimeUpdateTimeout = null;

let filterStatuses = new Set();

AW_STATUSES.forEach(status => {
    if (status !== 'Missing Data' && status !== 'Unknown' && status !== 'Deleted' && status !== 'On Hold') {
        filterStatuses.add(status);
    }
});

PL_STATUSES.forEach(status => {
    if (status === 'Planned' || status === 'Unplanned') {
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
// FORMAT DATE ONLY
// ============================================================
function formatDateOnly(date) {
    if (!date || isNaN(date.getTime())) return '01/01/1900';
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
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
    
    // Check if job is complete
    const isComplete = jobData.planningStatus === 'Complete' || jobData.isComplete === true;
    const isPlanned = jobData.planningStatus === 'Planned';
    
    // If complete, add printed class and disable dragging
    if (isComplete) {
        job.classList.add('job-printed');
        job.setAttribute('draggable', 'false');
    }
    
    // AW status handling
    let awStatus = jobData.awStatus || jobData.status || 'Missing Data';
    const displayStatus = isComplete ? 'Complete' : awStatus;
    const statusColor = isComplete ? '#95a5a6' : (statusColorMap[awStatus] || '#6c757d');
    const statusDisplay = isComplete ? 'Complete' : (statusDisplayMap[awStatus] || awStatus || 'Unknown');
    
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
    
    // Get priority
    const priority = jobData.priority !== undefined ? jobData.priority : null;
    
    // Priority color coding
    let priorityColor = '#6c757d';
    let priorityBgColor = 'rgba(108, 117, 125, 0.15)';
    let priorityBorderColor = 'rgba(108, 117, 125, 0.3)';
    
    if (priority !== null) {
        if (priority <= 3) {
            priorityColor = '#dc3545';
            priorityBgColor = 'rgba(220, 53, 69, 0.15)';
            priorityBorderColor = 'rgba(220, 53, 69, 0.3)';
        } else if (priority <= 10) {
            priorityColor = '#fd7e14';
            priorityBgColor = 'rgba(253, 126, 20, 0.15)';
            priorityBorderColor = 'rgba(253, 126, 20, 0.3)';
        } else if (priority <= 50) {
            priorityColor = '#ffc107';
            priorityBgColor = 'rgba(255, 193, 7, 0.15)';
            priorityBorderColor = 'rgba(255, 193, 7, 0.3)';
        } else if (priority <= 100) {
            priorityColor = '#17a2b8';
            priorityBgColor = 'rgba(23, 162, 184, 0.15)';
            priorityBorderColor = 'rgba(23, 162, 184, 0.3)';
        } else {
            priorityColor = '#6c757d';
            priorityBgColor = 'rgba(108, 117, 125, 0.15)';
            priorityBorderColor = 'rgba(108, 117, 125, 0.3)';
        }
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
    
    // Build priority badge HTML
    let priorityBadgeHTML = '';
    if (priority !== null && !isComplete) {
        priorityBadgeHTML = `
            <span class="job-priority-badge" 
                  style="background-color:${priorityBgColor}; 
                         color:${priorityColor}; 
                         border:1px solid ${priorityBorderColor};
                         font-size:8px;
                         font-weight:700;
                         padding:1px 5px;
                         border-radius:3px;
                         margin-left:4px;
                         white-space:nowrap;
                         display:inline-block;
                         animation: priorityPulse 2s ease-in-out infinite;">
                ⚡ ${priority}
            </span>
        `;
    }
    
    // Complete badge for completed jobs
    let completeBadgeHTML = '';
    if (isComplete) {
        completeBadgeHTML = `
            <span class="job-complete-badge" 
                  style="background-color:#6c757d20; 
                         color:#6c757d; 
                         border:1px solid #6c757d40;
                         font-size:8px;
                         font-weight:700;
                         padding:1px 5px;
                         border-radius:3px;
                         margin-left:4px;
                         white-space:nowrap;
                         display:inline-block;">
                ✅ Complete
            </span>
        `;
    }
    
    // Planned badge for planned jobs
    let plannedBadgeHTML = '';
    if (isPlanned && !isComplete) {
        plannedBadgeHTML = `
            <span class="job-planned-badge" 
                  style="background-color:#28a74520; 
                         color:#28a745; 
                         border:1px solid #28a74540;
                         font-size:8px;
                         font-weight:700;
                         padding:1px 5px;
                         border-radius:3px;
                         margin-left:4px;
                         white-space:nowrap;
                         display:inline-block;
                         animation: plannedPulse 3s ease-in-out infinite;">
                📋 Planned
            </span>
        `;
    }
    
    job.innerHTML = `
        <div class="job-name">
            <span class="job-number-badge">${jobNumber}</span>
            ${jobData.name}
            ${plannedBadgeHTML}
            ${completeBadgeHTML}
            ${priorityBadgeHTML}
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
                           title="Setup time in minutes"
                           ${isComplete ? 'disabled' : ''}>
                </label>
            </div>
            <div class="job-field-group">
                <label>Qty (m):
                    <input type="number" class="job-quantity-input" 
                           data-job-id="${jobId}"
                           value="${Math.round(jobData.quantity)}" 
                           min="0" step="1"
                           title="Quantity in meters"
                           ${isComplete ? 'disabled' : ''}>
                </label>
            </div>
            <div class="job-field-group">
                <label>Speed (m/min):
                    <input type="number" class="job-speed-input" 
                           data-job-id="${jobId}"
                           value="${currentSpeed}" 
                           min="1" step="1"
                           title="Press speed in meters per minute"
                           ${isComplete ? 'disabled' : ''}>
                </label>
            </div>
        </div>
    `;
    
    // Setup input event listeners (only if not complete)
    if (!isComplete) {
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
    }
    
    // Click event - show on timeline if Planned, otherwise select
    job.addEventListener('click', function(e) {
        e.stopPropagation();
        
        if (e.target.closest('input') || e.target.closest('button') || e.target.closest('select')) {
            return;
        }
        
        const jobId = this.getAttribute('data-job-id');
        const jobData = jobDatabase[jobId];
        
        if (jobData && jobData.planningStatus === 'Planned' && !jobData.isComplete) {
            console.log('Planned job clicked - showing on timeline:', jobId);
            if (typeof showJobOnTimeline === 'function') {
                showJobOnTimeline(jobId);
            } else if (typeof window.showJobOnTimeline === 'function') {
                window.showJobOnTimeline(jobId);
            }
            return;
        }
        
        selectJob(this);
    });
    
    // Double click always opens modal
    job.addEventListener('dblclick', function(e) {
        e.stopPropagation();
        if (e.target.closest('input') || e.target.closest('button') || e.target.closest('select')) {
            return;
        }
        const jobId = this.getAttribute('data-job-id');
        if (jobId && typeof openJobDetailsModal === 'function') {
            openJobDetailsModal(jobId);
        }
    });
    
    // Shift+click or Ctrl+click always opens modal
    job.addEventListener('click', function(e) {
        if (e.shiftKey || e.ctrlKey || e.metaKey) {
            e.stopPropagation();
            if (e.target.closest('input') || e.target.closest('button') || e.target.closest('select')) {
                return;
            }
            const jobId = this.getAttribute('data-job-id');
            if (jobId && typeof openJobDetailsModal === 'function') {
                openJobDetailsModal(jobId);
            }
        }
    });
    
    // Tooltip for priority
    if (priority !== null && !isComplete) {
        const priorityBadge = job.querySelector('.job-priority-badge');
        if (priorityBadge) {
            let priorityLabel = 'Priority';
            if (priority <= 3) priorityLabel = 'Critical Priority';
            else if (priority <= 10) priorityLabel = 'High Priority';
            else if (priority <= 50) priorityLabel = 'Medium Priority';
            else if (priority <= 100) priorityLabel = 'Low Priority';
            else priorityLabel = 'Lowest Priority';
            
            priorityBadge.setAttribute('title', `${priorityLabel}: ${priority}`);
        }
    }
    
    if (isComplete) {
        job.setAttribute('title', `Completed - ${jobData.name || jobId}`);
    }
    
    return job;
}

// ============================================================
// CREATE FEED JOB ELEMENT
// ============================================================
function createFeedJobElement(jobId, jobData) {
    const feedJob = document.createElement('div');
    feedJob.className = 'feed-job';
    feedJob.setAttribute('data-job-id', jobId);
    feedJob.setAttribute('draggable', 'true');
    
    const duration = calculateJobDuration(jobData, jobId);
    
    let awStatus = jobData.rawAWStatus || jobData.awStatus || jobData.status || 'Unknown';
    if (awStatus === '' || awStatus === 'Pending') {
        awStatus = 'Unknown';
    }
    
    if (awStatus === 'Unknown' && jobData.planningStatus && jobData.planningStatus !== 'Unplanned') {
        awStatus = jobData.planningStatus;
    }
    
    const statusColor = statusColorMap[awStatus] || '#6c757d';
    const statusDisplay = statusDisplayMap[awStatus] || awStatus || 'Unknown';
    
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
    
    const plStatus = jobData.planningStatus || 'Unplanned';
    const plDisplayStatus = statusDisplayMap[plStatus] || plStatus || 'Unknown';
    const plStatusColor = statusColorMap[plStatus] || '#6c757d';
    const isPlanned = plStatus === 'Planned';
    const isComplete = plStatus === 'Complete' || plStatus === 'Printed';
    
    const jobNumber = jobData.jobNumber || jobId.replace('job-', 'JOB-').padEnd(8, '0');
    
    let estimatedDateFormatted = '';
    let estimatedDisplayText = '';
    if (jobData.estimatedDate) {
        const dateObj = new Date(jobData.estimatedDate);
        if (!isNaN(dateObj.getTime()) && dateObj.getFullYear() > 1900) {
            estimatedDateFormatted = formatDateOnly(dateObj);
            estimatedDisplayText = `AW: Est: ${estimatedDateFormatted}`;
        }
    }
    
    const showEstimated = awStatus === '8. Repro: Plate Making' || awStatus === '5. Working on Cromalin';
    
    const priority = jobData.priority !== undefined ? jobData.priority : null;
    const priorityDisplay = priority !== null ? `Priority: ${priority}` : '';
    
    let priorityColor = '#6c757d';
    let priorityBgColor = 'rgba(108, 117, 125, 0.15)';
    let priorityBorderColor = 'rgba(108, 117, 125, 0.3)';
    
    if (priority !== null) {
        if (priority <= 3) {
            priorityColor = '#dc3545';
            priorityBgColor = 'rgba(220, 53, 69, 0.15)';
            priorityBorderColor = 'rgba(220, 53, 69, 0.3)';
        } else if (priority <= 10) {
            priorityColor = '#fd7e14';
            priorityBgColor = 'rgba(253, 126, 20, 0.15)';
            priorityBorderColor = 'rgba(253, 126, 20, 0.3)';
        } else if (priority <= 50) {
            priorityColor = '#ffc107';
            priorityBgColor = 'rgba(255, 193, 7, 0.15)';
            priorityBorderColor = 'rgba(255, 193, 7, 0.3)';
        } else if (priority <= 100) {
            priorityColor = '#17a2b8';
            priorityBgColor = 'rgba(23, 162, 184, 0.15)';
            priorityBorderColor = 'rgba(23, 162, 184, 0.3)';
        } else {
            priorityColor = '#6c757d';
            priorityBgColor = 'rgba(108, 117, 125, 0.15)';
            priorityBorderColor = 'rgba(108, 117, 125, 0.3)';
        }
    }
    
    const isOnTimeline = !!document.querySelector(`.job[data-job-id="${jobId}"]`);
    const machineDisplay = jobData.machine ? `Machine ${jobData.machine}` : '';
    
    if (isPlanned && isOnTimeline) {
        feedJob.classList.add('feed-job-planned-on-timeline');
        feedJob.setAttribute('title', `Click to view "${jobData.name || jobId}" on timeline`);
        feedJob.style.cursor = 'pointer';
    } else if (isPlanned) {
        feedJob.classList.add('feed-job-planned');
    }
    
    if (isComplete) {
        feedJob.classList.add('feed-job-complete');
    }
    
    
    const completeBadge = isComplete ? 
        `<span class="feed-complete-badge" style="font-size:9px; background:#6c757d20; color:#6c757d; border:1px solid #6c757d40; padding:1px 6px; border-radius:3px; margin-left:4px;">✅ Complete</span>` : '';
    
    feedJob.innerHTML = `
        <div class="feed-item-content">
            <div class="feed-item-header">
                <span class="feed-job-number">${jobNumber}</span>
                <span class="feed-job-name">${jobData.name || 'Unnamed'}</span>
                ${completeBadge}
                ${priorityDisplay ? `
                    <span class="feed-priority" 
                          style="background-color:${priorityBgColor}; 
                                 color:${priorityColor}; 
                                 border:1px solid ${priorityBorderColor};
                                 font-size:10px;
                                 padding:2px 6px;
                                 border-radius:3px;
                                 font-weight:600;
                                 margin-left:6px;">
                        ⚡ ${priorityDisplay}
                    </span>
                ` : ''}
                ${machineDisplay ? `
                    <span class="feed-machine-badge" 
                          style="font-size:9px; 
                                 background-color:#e9ecef; 
                                 color:#495057; 
                                 padding:1px 6px; 
                                 border-radius:3px; 
                                 margin-left:4px;">
                        ⚙️ ${machineDisplay}
                    </span>
                ` : ''}
    
            </div>
            <div class="feed-status-wrapper">
                <span class="feed-status" 
                      data-raw-status="${awStatus}"
                      style="background-color:${statusColor}20; 
                             color:${statusColor}; 
                             border:1px solid ${statusColor}40;
                             padding:2px 8px;
                             border-radius:3px;
                             font-size:11px;">
                    AW: ${statusDisplay} since: ${statusDateFormatted}
                </span>
                ${showEstimated && estimatedDisplayText ? 
                    `<span class="feed-estimated-date" 
                           style="color:${statusColor}; 
                                  background-color:${statusColor}15; 
                                  border-color:${statusColor}40;
                                  font-size:10px;
                                  padding:1px 6px;
                                  border-radius:3px;
                                  border:1px solid;
                                  margin-left:4px;">
                        ${estimatedDisplayText}
                    </span>` : ''
                }
            </div>
            <div class="feed-pl-status-wrapper">
                <span class="feed-pl-status" 
                      data-raw-pl-status="${plStatus}"
                      style="background-color:${plStatusColor}20; 
                             color:${plStatusColor}; 
                             border:1px solid ${plStatusColor}40;
                             padding:2px 8px;
                             border-radius:3px;
                             font-size:11px;">
                    PL: ${plDisplayStatus}
                </span>
                ${jobData.quantity ? `
                    <span class="feed-quantity" 
                          style="font-size:10px; 
                                 color:#6c757d; 
                                 margin-left:6px;">
                        QTY: ${Math.round(jobData.quantity)}m
                    </span>
                ` : ''}
                ${jobData.setup ? `
                    <span class="feed-setup" 
                          style="font-size:10px; 
                                 color:#6c757d; 
                                 margin-left:6px;">
                        Setup: ${Math.round(jobData.setup)}min
                    </span>
                ` : ''}
                ${duration ? `
                    <span class="feed-duration" 
                          style="font-size:10px; 
                                 color:#6c757d; 
                                 margin-left:6px;">
                        Duration: ${Math.round(duration)}min
                    </span>
                ` : ''}
            </div>
        </div>
    `;
    
    feedJob.addEventListener('click', function(e) {
        e.stopPropagation();
        
        if (e.target.closest('input') || e.target.closest('button') || 
            e.target.closest('.feed-status') || e.target.closest('.feed-pl-status')) {
            return;
        }
        
        const jobId = this.getAttribute('data-job-id');
        const jobData = jobDatabase[jobId];
        
        if (jobData && jobData.planningStatus === 'Planned') {
            const isOnTimeline = !!document.querySelector(`.job[data-job-id="${jobId}"]`);
            if (isOnTimeline) {
                console.log('Planned feed job clicked - showing on timeline:', jobId);
                if (typeof showJobOnTimeline === 'function') {
                    showJobOnTimeline(jobId);
                } else if (typeof window.showJobOnTimeline === 'function') {
                    window.showJobOnTimeline(jobId);
                }
                return;
            }
        }
        
        selectJob(this);
    });
    
    feedJob.addEventListener('dblclick', function(e) {
        e.stopPropagation();
        const jobId = this.getAttribute('data-job-id');
        if (typeof openJobDetailsModal === 'function') {
            openJobDetailsModal(jobId);
        }
    });
    
    feedJob.addEventListener('click', function(e) {
        if (e.shiftKey || e.ctrlKey || e.metaKey) {
            e.stopPropagation();
            const jobId = this.getAttribute('data-job-id');
            if (typeof openJobDetailsModal === 'function') {
                openJobDetailsModal(jobId);
            }
        }
    });
    
    feedJob.addEventListener('dragstart', function(e) {
        this.classList.add('feed-job-dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', jobId);
    });
    
    feedJob.addEventListener('dragend', function(e) {
        this.classList.remove('feed-job-dragging');
    });
    
    return feedJob;
}

// ============================================================
// UPDATE FEED ITEM STATUS
// ============================================================
function updateFeedItemStatus(jobId) {
    const feedItem = document.querySelector(`.feed-job[data-job-id="${jobId}"]`);
    if (!feedItem) return;
    
    const jobData = jobDatabase[jobId];
    if (!jobData) return;
    
    const plStatus = jobData.planningStatus || 'Unplanned';
    const isComplete = plStatus === 'Complete' || jobData.isComplete === true;
    const isPlanned = plStatus === 'Planned';
    const isOnTimeline = !!document.querySelector(`.job[data-job-id="${jobId}"]`);
    
    const plStatusElement = feedItem.querySelector('.feed-pl-status');
    if (plStatusElement) {
        const plStatusColor = isComplete ? '#6c757d' : (statusColorMap[plStatus] || '#6c757d');
        const displayName = isComplete ? 'Complete' : (statusDisplayMap[plStatus] || plStatus || 'Unknown');
        
        plStatusElement.setAttribute('data-raw-pl-status', plStatus);
        plStatusElement.textContent = `PL: ${displayName}`;
        plStatusElement.style.backgroundColor = `${plStatusColor}20`;
        plStatusElement.style.color = plStatusColor;
        plStatusElement.style.border = `1px solid ${plStatusColor}40`;
    }
    
    feedItem.classList.remove('feed-job-planned', 'feed-job-planned-on-timeline', 'feed-job-complete');
    
    if (isComplete) {
        feedItem.classList.add('feed-job-complete');
    } else if (isPlanned && isOnTimeline) {
        feedItem.classList.add('feed-job-planned-on-timeline');
    } else if (isPlanned) {
        feedItem.classList.add('feed-job-planned');
    }
    
    const header = feedItem.querySelector('.feed-item-header');
    if (header) {
        header.querySelectorAll('.feed-planned-badge, .feed-complete-badge').forEach(el => el.remove());
        
        if (isComplete) {
            const completeBadge = document.createElement('span');
            completeBadge.className = 'feed-complete-badge';
            completeBadge.style.cssText = 'font-size:9px; background:#6c757d20; color:#6c757d; border:1px solid #6c757d40; padding:1px 6px; border-radius:3px; margin-left:4px;';
            completeBadge.textContent = '✅ Complete';
            header.appendChild(completeBadge);
        } else if (isPlanned) {
            const plannedBadge = document.createElement('span');
            plannedBadge.className = 'feed-planned-badge';
            plannedBadge.style.cssText = 'font-size:9px; background:#28a74520; color:#28a745; border:1px solid #28a74540; padding:1px 6px; border-radius:3px; margin-left:4px; animation: plannedPulse 3s ease-in-out infinite;';
            plannedBadge.textContent = '📋 Planned';
            header.appendChild(plannedBadge);
        }
    }
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
    
    if (sortedJobIds.length === 0) {
        productionFeedList.innerHTML = `
            <div style="text-align:center; padding:40px 20px; color:#6c757d;">
                <i class="fas fa-inbox" style="font-size:32px; display:block; margin-bottom:12px;"></i>
                <p>No jobs in the feed. Upload AW or PL data to get started.</p>
            </div>
        `;
        updateStatistics();
        return;
    }
    
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
    
    const plannedJobsElement = document.getElementById('stat-planned');
    const pendingJobsElement = document.getElementById('stat-pending');
    
    if (plannedJobsElement) plannedJobsElement.textContent = timelineJobs;
    if (pendingJobsElement) pendingJobsElement.textContent = visibleFeedItems.length;
    
    const feedCountElement = document.getElementById('feed-count');
    if (feedCountElement) feedCountElement.textContent = `${allFeedItems.length} jobs`;
    
    const visibleCountElement = document.getElementById('feed-visible-count');
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
        const filterBtn = document.getElementById('filter-btn');
        if (filterBtn) {
            filterBtn.classList.toggle('active');
        }
        updateFilterBadge();
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
            <span class="filter-action-link" id="select-all-statuses">Select All</span>
            <span class="filter-action-link" id="clear-all-statuses">Clear All</span>
            <span class="filter-action-link" id="reset-default-filter">Reset Default</span>
        </div>
    `;
    filterPanel.appendChild(header);
    
    const info = document.createElement('div');
    info.className = 'filter-info';
    info.innerHTML = `
        <i class="fas fa-info-circle"></i> 
        ARTWORK and PLANNING filters work independently. A job must match <strong>BOTH</strong> active filter sets to be shown.
        If no filters are selected in a category, all jobs in that category are shown.
    `;
    filterPanel.appendChild(info);
    
    const awSection = document.createElement('div');
    awSection.className = 'filter-section';
    awSection.innerHTML = `
        <div class="filter-section-title">
            <span class="section-label">
                <i class="fas fa-paint-brush" style="color:var(--accent);"></i> AW Status
                <span class="badge-aw">Artwork</span>
            </span>
            <div>
                <span class="filter-action-link-small" id="aw-select-all">Select All</span>
                <span class="filter-action-link-small" id="aw-clear-all">Clear All</span>
            </div>
        </div>
    `;
    filterPanel.appendChild(awSection);
    
    const awList = document.createElement('div');
    awList.className = 'filter-list filter-list-single';
    
    AW_STATUSES.forEach(status => {
        const item = document.createElement('label');
        item.className = 'filter-item';
        const color = statusColorMap[status] || '#6c757d';
        const isChecked = filterStatuses.has(status);
        const displayName = statusDisplayMap[status] || status;
        const countId = `count-${status.replace(/\s/g, '-')}`;
        item.innerHTML = `
            <input type="checkbox" value="${status}" ${isChecked ? 'checked' : ''} data-type="aw">
            <span class="filter-color" style="background-color:${color}"></span>
            <span class="filter-label">${displayName}</span>
            <span class="filter-count" id="${countId}">0</span>
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
            updateFilterBadge();
        });
    });
    filterPanel.appendChild(awList);
    
    const divider = document.createElement('hr');
    divider.className = 'filter-divider';
    filterPanel.appendChild(divider);
    
    const plSection = document.createElement('div');
    plSection.className = 'filter-section';
    plSection.innerHTML = `
        <div class="filter-section-title">
            <span class="section-label">
                <i class="fas fa-calendar-alt" style="color:var(--warning);"></i> PL Status
                <span class="badge-pl">Planning</span>
            </span>
            <div>
                <span class="filter-action-link-small" id="pl-select-all">Select All</span>
                <span class="filter-action-link-small" id="pl-clear-all">Clear All</span>
            </div>
        </div>
    `;
    filterPanel.appendChild(plSection);
    
    const plList = document.createElement('div');
    plList.className = 'filter-list filter-list-single';
    
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
            if (this.checked) {
                filterStatuses.add(status);
            } else {
                filterStatuses.delete(status);
            }
            applyFilter();
            updateStatistics();
            updateFilterBadge();
        });
    });
    filterPanel.appendChild(plList);
    
    const feedControls = document.querySelector('.feed-controls');
    const feedContainer = document.getElementById('production-feed-container');
    if (feedControls && feedContainer) {
        feedControls.parentNode.insertBefore(filterPanel, feedContainer);
    } else if (feedControls) {
        feedControls.parentNode.insertBefore(filterPanel, feedControls.nextSibling);
    }
    
    document.getElementById('aw-select-all').addEventListener('click', function(e) {
        e.stopPropagation();
        AW_STATUSES.forEach(status => filterStatuses.add(status));
        awList.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = true);
        applyFilter();
        updateStatistics();
        updateFilterBadge();
    });
    
    document.getElementById('aw-clear-all').addEventListener('click', function(e) {
        e.stopPropagation();
        AW_STATUSES.forEach(status => filterStatuses.delete(status));
        awList.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false);
        applyFilter();
        updateStatistics();
        updateFilterBadge();
    });
    
    document.getElementById('pl-select-all').addEventListener('click', function(e) {
        e.stopPropagation();
        PL_STATUSES.forEach(status => filterStatuses.add(status));
        plList.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = true);
        applyFilter();
        updateStatistics();
        updateFilterBadge();
    });
    
    document.getElementById('pl-clear-all').addEventListener('click', function(e) {
        e.stopPropagation();
        PL_STATUSES.forEach(status => filterStatuses.delete(status));
        plList.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false);
        applyFilter();
        updateStatistics();
        updateFilterBadge();
    });
    
    document.getElementById('select-all-statuses').addEventListener('click', function(e) {
        e.stopPropagation();
        ALL_STATUSES.forEach(status => filterStatuses.add(status));
        filterPanel.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = true);
        applyFilter();
        updateStatistics();
        updateFilterBadge();
    });
    
    document.getElementById('clear-all-statuses').addEventListener('click', function(e) {
        e.stopPropagation();
        filterStatuses = new Set();
        filterPanel.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false);
        applyFilter();
        updateStatistics();
        updateFilterBadge();
    });
    
    document.getElementById('reset-default-filter').addEventListener('click', function(e) {
        e.stopPropagation();
        filterStatuses = new Set();
        AW_STATUSES.forEach(status => {
            if (status !== 'Missing Data' && status !== 'Deleted' && status !== 'On Hold') {
                filterStatuses.add(status);
            }
        });
        filterStatuses.add('Unknown');
        PL_STATUSES.forEach(status => {
            if (status === 'Planned' || status === 'Unplanned') {
                filterStatuses.add(status);
            }
        });
        filterPanel.querySelectorAll('input[type="checkbox"]').forEach(cb => {
            cb.checked = filterStatuses.has(cb.value);
        });
        applyFilter();
        updateStatistics();
        updateFilterBadge();
    });
    
    setTimeout(() => {
        filterPanel.classList.add('active');
        const filterBtn = document.getElementById('filter-btn');
        if (filterBtn) {
            filterBtn.classList.add('active');
        }
        updateFilterCounts();
        updateFilterBadge();
    }, 50);
}

function updateFilterBadge() {
    const filterBadge = document.getElementById('filter-badge');
    if (!filterBadge) return;
    
    let activeCount = 0;
    for (const status of filterStatuses) {
        activeCount++;
    }
    
    const totalFilters = ALL_STATUSES.length;
    
    if (activeCount > 0 && activeCount < totalFilters) {
        filterBadge.textContent = activeCount;
        filterBadge.style.display = 'inline-block';
    } else if (activeCount === totalFilters) {
        filterBadge.textContent = 'All';
        filterBadge.style.display = 'inline-block';
    } else {
        filterBadge.textContent = '0';
        filterBadge.style.display = 'none';
    }
}

function syncFilterCheckboxes() {
    const filterPanel = document.getElementById('filter-panel');
    if (!filterPanel) return;
    
    const checkboxes = filterPanel.querySelectorAll('input[type="checkbox"]');
    checkboxes.forEach(cb => {
        const status = cb.value;
        cb.checked = filterStatuses.has(status);
    });
    updateFilterBadge();
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
                const match = text.match(/AW:\s*(.+?)(?:\s+since:|$)/);
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
        if (jobData) {
            if (jobData.planningStatus) {
                plStatus = jobData.planningStatus;
            }
            if (jobData.rawAWStatus) {
                awStatus = jobData.rawAWStatus;
            } else if (jobData.awStatus) {
                awStatus = jobData.awStatus;
            }
        }
        
        let awMatched = null;
        if (awStatus) {
            if (AW_STATUSES.includes(awStatus)) {
                awMatched = awStatus;
            } else {
                awMatched = AW_STATUSES.find(s => statusDisplayMap[s] === awStatus);
                if (!awMatched) {
                    const isPLStatus = PL_STATUSES.some(s => statusDisplayMap[s] === awStatus || s === awStatus);
                    if (isPLStatus || awStatus === '' || awStatus === 'Pending') {
                        awMatched = 'Unknown';
                    } else {
                        awMatched = 'Unknown';
                    }
                }
            }
        } else {
            awMatched = 'Unknown';
        }
        
        let plMatched = null;
        if (plStatus) {
            if (PL_STATUSES.includes(plStatus)) {
                plMatched = plStatus;
            } else {
                for (const [key, value] of Object.entries(statusDisplayMap)) {
                    if (value === plStatus && PL_STATUSES.includes(key)) {
                        plMatched = key;
                        break;
                    }
                }
                if (!plMatched) {
                    plMatched = 'Unplanned';
                }
            }
        } else {
            plMatched = 'Unplanned';
        }
        
        let awVisible = true;
        if (hasAWFilter) {
            if (awMatched === 'Unknown' && !awFilterStatuses.has('Unknown')) {
                if (hasPLFilter) {
                    awVisible = plFilterStatuses.has(plMatched);
                } else {
                    awVisible = false;
                }
            } else {
                awVisible = awFilterStatuses.has(awMatched);
            }
        }
        
        let plVisible = true;
        if (hasPLFilter) {
            plVisible = plFilterStatuses.has(plMatched);
        }
        
        let isVisible = false;
        if (hasAWFilter && hasPLFilter) {
            isVisible = awVisible && plVisible;
        } else if (hasAWFilter) {
            isVisible = awVisible;
        } else if (hasPLFilter) {
            isVisible = plVisible;
        } else {
            isVisible = true;
        }
        
        if (isVisible) {
            item.classList.remove('filter-hidden');
            visibleCount++;
        } else {
            item.classList.add('filter-hidden');
        }
    });
    
    const visibleJobsElement = document.getElementById('feed-visible-count');
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
        const jobId = item.getAttribute('data-job-id');
        const jobData = jobDatabase[jobId];
        
        let awStatus = jobData?.rawAWStatus || jobData?.awStatus || jobData?.status || 'Unknown';
        
        let awMatched = null;
        if (AW_STATUSES.includes(awStatus)) {
            awMatched = awStatus;
        } else {
            awMatched = AW_STATUSES.find(s => statusDisplayMap[s] === awStatus);
            if (!awMatched) {
                const isPLStatus = PL_STATUSES.some(s => statusDisplayMap[s] === awStatus || s === awStatus);
                if (isPLStatus || awStatus === '' || awStatus === 'Pending') {
                    awMatched = 'Unknown';
                } else {
                    awMatched = 'Unknown';
                }
            }
        }
        if (awMatched) counts[awMatched] = (counts[awMatched] || 0) + 1;
        
        let plStatus = jobData?.planningStatus || 'Unplanned';
        
        let plMatched = null;
        if (PL_STATUSES.includes(plStatus)) {
            plMatched = plStatus;
        } else {
            for (const [key, value] of Object.entries(statusDisplayMap)) {
                if (value === plStatus && PL_STATUSES.includes(key)) {
                    plMatched = key;
                    break;
                }
            }
            if (!plMatched) {
                plMatched = 'Unplanned';
            }
        }
        if (plMatched) counts[plMatched] = (counts[plMatched] || 0) + 1;
    });
    
    ALL_STATUSES.forEach(status => {
        const badgeId = `count-${status.replace(/\s/g, '-')}`;
        const badge = document.getElementById(badgeId);
        if (badge) badge.textContent = counts[status] || 0;
    });
    
    const totalJobsElement = document.getElementById('feed-count');
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
            debouncedScaleTimeline(timeline.id);
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
            debouncedScaleTimeline(timeline.id);
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
            debouncedScaleTimeline(timeline.id);
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
    
    const validPLStatuses = ['Planned', 'Unplanned', 'Complete', 'PL-Deleted', 'PL-Hold'];
    const statusMap = {
        'Planned': 'Planned', 'Unplanned': 'Unplanned', 'Complete': 'Complete',
        'Deleted': 'PL-Deleted', 'Hold': 'PL-Hold'
    };
    
    const mappedStatus = statusMap[newPLStatus] || newPLStatus;
    if (!validPLStatuses.includes(mappedStatus)) {
        console.warn(`Invalid PL status: ${newPLStatus}. Using 'Unplanned' as fallback.`);
        return updateJobPLStatus(jobId, 'Unplanned');
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
        planningStatus: 'Unplanned',
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
    // Don't call updateCompletedJobs here - it's handled by the interval in timeline.js
}

// ============================================================
// UPDATE JOB TIME DISPLAY
// ============================================================
function updateJobTimeDisplay(jobId) {
    const jobElement = document.querySelector(`.job[data-job-id="${jobId}"]`);
    if (!jobElement || !jobSchedule[jobId]) return;
    
    const schedule = jobSchedule[jobId];
    const startTime = new Date(schedule.startTime);
    const endTime = new Date(schedule.endTime);
    
    const timeElement = jobElement.querySelector('.job-time');
    if (timeElement) {
        const duration = (endTime - startTime) / (60 * 60 * 1000);
        if (duration >= 6) {
            timeElement.textContent = `${formatDateTime(startTime)} → ${formatDateTime(endTime)}`;
        } else {
            timeElement.textContent = `${formatTime(startTime)} → ${formatTime(endTime)}`;
        }
    }
    
    const timeRange = jobElement.querySelector('.job-time-range');
    if (timeRange) {
        timeRange.remove();
    }
    
    jobElement.dataset.startTime = schedule.startTime;
    jobElement.dataset.endTime = schedule.endTime;
}

function updateAllJobTimes() {
    if (isUpdatingJobTimes) {
        return;
    }
    isUpdatingJobTimes = true;
    
    try {
        const timelineIds = new Set();
        
        for (let jobId in jobSchedule) {
            const jobElement = document.querySelector(`.job[data-job-id="${jobId}"]`);
            if (!jobElement || !jobSchedule[jobId]) continue;
            
            const schedule = jobSchedule[jobId];
            const startTime = new Date(schedule.startTime);
            const endTime = new Date(schedule.endTime);
            
            const timeElement = jobElement.querySelector('.job-time');
            if (timeElement) {
                const duration = (endTime - startTime) / (60 * 60 * 1000);
                if (duration >= 6) {
                    timeElement.textContent = `${formatDateTime(startTime)} → ${formatDateTime(endTime)}`;
                } else {
                    timeElement.textContent = `${formatTime(startTime)} → ${formatTime(endTime)}`;
                }
            }
            
            jobElement.dataset.startTime = schedule.startTime;
            jobElement.dataset.endTime = schedule.endTime;
            
            const timeline = jobElement.closest('.timeline');
            if (timeline) {
                timelineIds.add(timeline.id);
            }
        }
        
        if (timelineIds.size > 0) {
            if (jobTimeUpdateTimeout) {
                clearTimeout(jobTimeUpdateTimeout);
                jobTimeUpdateTimeout = null;
            }
            
            jobTimeUpdateTimeout = setTimeout(() => {
                const ids = Array.from(timelineIds);
                ids.forEach(id => {
                    if (typeof debouncedScaleTimeline === 'function') {
                        debouncedScaleTimeline(id, 300);
                    } else {
                        delete timelineStateCache[id];
                        if (typeof scaleTimeline === 'function') {
                            scaleTimeline(id);
                        }
                    }
                });
                jobTimeUpdateTimeout = null;
            }, 500);
        }
        
    } finally {
        setTimeout(() => {
            isUpdatingJobTimes = false;
        }, 100);
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
window.syncFilterCheckboxes = syncFilterCheckboxes;
window.updateFeedItemStatus = updateFeedItemStatus;
window.formatDateOnly = formatDateOnly;

console.log('✅ feed.js loaded');
