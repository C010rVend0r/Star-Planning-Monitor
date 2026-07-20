// script-modal.js
// ============================================================
// JOB DETAILS MODAL
// ============================================================

let currentModalJobId = null;

function setupModalEventListeners() {
    console.log('Setting up modal event listeners...');
    
    const closeBtn = document.getElementById('modal-close-btn');
    if (closeBtn) closeBtn.addEventListener('click', closeJobDetailsModal);
    
    const cancelBtn = document.getElementById('modal-cancel-btn');
    if (cancelBtn) cancelBtn.addEventListener('click', closeJobDetailsModal);
    
    const saveBtn = document.getElementById('modal-save-btn');
    if (saveBtn) saveBtn.addEventListener('click', saveJobDetailsFromModal);
    
    const addBtn = document.getElementById('modal-add-to-timeline');
    if (addBtn) addBtn.addEventListener('click', addJobToTimelineFromModal);
    
    const removeBtn = document.getElementById('modal-remove-from-timeline');
    if (removeBtn) removeBtn.addEventListener('click', removeJobFromTimelineFromModal);
    
    const modal = document.getElementById('job-details-modal');
    if (modal) {
        modal.addEventListener('click', function(e) {
            if (e.target === this) closeJobDetailsModal();
        });
    }
    
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            const modal = document.getElementById('job-details-modal');
            if (modal && modal.classList.contains('active')) closeJobDetailsModal();
        }
    });
}

function setupModalClickTriggers() {
    console.log('Setting up modal click triggers...');
    
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
    
    document.addEventListener('dblclick', function(e) {
        const timelineJob = e.target.closest('.job');
        if (timelineJob) {
            if (e.target.closest('input') || e.target.closest('button') || e.target.closest('select')) return;
            const jobId = timelineJob.getAttribute('data-job-id');
            if (jobId) {
                e.stopPropagation();
                console.log('Timeline job double-clicked:', jobId);
                openJobDetailsModal(jobId);
            }
        }
    });
    
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
                if (e.target.closest('input') || e.target.closest('button') || e.target.closest('select')) return;
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
        .feed-job:hover::after { opacity: 0.7; }
        .job::after {
            content: " 🔍";
            font-size: 12px;
            opacity: 0;
            transition: opacity 0.3s;
            margin-left: 4px;
        }
        .job:hover::after { opacity: 0.8; }
        .job-printed::after { display: none; }
    `;
    document.head.appendChild(style);
}

// In modal.js - update openJobDetailsModal function

function openJobDetailsModal(jobId) {
    console.log('Opening modal for job:', jobId);
    
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
        if (timelineJob) {
            const timeline = timelineJob.closest('.timeline');
            if (timeline) {
                const timelineContainer = timeline.closest('.timeline-container');
                if (timelineContainer) {
                    const machineElement = timelineContainer.closest('.machine');
                    if (machineElement) {
                        const machineNumber = machineElement.getAttribute('data-machine');
                        if (machineNumber && machineNumber !== '') {
                            machineSelect.value = machineNumber;
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
    
    const plStatus = jobData.planningStatus || 'Unplanned';
    const plStatusSelect = document.getElementById('modal-pl-status');
    if (plStatusSelect) plStatusSelect.value = plStatus;
    
    // Status date
    const statusDate = jobData.statusDate ? new Date(jobData.statusDate) : new Date();
    const dateInput = document.getElementById('modal-status-date');
    if (dateInput) {
        if (!isNaN(statusDate.getTime()) && statusDate.getFullYear() > 1900) {
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
    
    // ============================================================
    // ADD ESTIMATED DATE HANDLING
    // ============================================================
    const estimatedDateInput = document.getElementById('modal-estimated-date');
    const estimatedContainer = document.getElementById('modal-estimated-date-container');
    
    if (estimatedDateInput && estimatedContainer) {
        // Check if estimated date should be shown
        const showEstimated = awStatus === '8. Repro: Plate Making' || awStatus === '5. Working on Cromalin';
        
        if (showEstimated && jobData.estimatedDate) {
            estimatedContainer.style.display = 'block';
            const estimatedDate = new Date(jobData.estimatedDate);
            if (!isNaN(estimatedDate.getTime()) && estimatedDate.getFullYear() > 1900) {
                const year = estimatedDate.getFullYear();
                const month = String(estimatedDate.getMonth() + 1).padStart(2, '0');
                const day = String(estimatedDate.getDate()).padStart(2, '0');
                const hours = String(estimatedDate.getHours()).padStart(2, '0');
                const minutes = String(estimatedDate.getMinutes()).padStart(2, '0');
                estimatedDateInput.value = `${year}-${month}-${day}T${hours}:${minutes}`;
            } else {
                estimatedDateInput.value = '';
            }
        } else {
            estimatedContainer.style.display = 'none';
            estimatedDateInput.value = '';
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
    const plStatus = plStatusSelect ? plStatusSelect.value : 'Unplanned';
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
    
    // Check if status changed to Complete
    const wasComplete = jobData.planningStatus === 'Complete' || jobData.isComplete === true;
    const isNowComplete = plStatus === 'Complete';
    
    // Update job database with machine
    jobData.name = name;
    jobData.setup = setup;
    jobData.quantity = quantity;
    jobData.awStatus = awStatus;
    jobData.rawAWStatus = awStatus;
    jobData.status = awStatus;
    jobData.planningStatus = plStatus;
    jobData.statusDate = statusDate.toISOString();
    jobData.machine = machine;
    jobData.isComplete = isNowComplete;
    
    console.log(`✅ Machine saved for job ${jobId}: ${machine}`);
    
    // Update PL database
    if (plDatabase[jobId]) {
        plDatabase[jobId].jobName = name;
        plDatabase[jobId].setupTime = setup;
        plDatabase[jobId].meters = quantity;
        plDatabase[jobId].prepressStatus = awStatus;
        plDatabase[jobId].planningStatus = plStatus;
        plDatabase[jobId].statusDate = statusDate.toISOString();
        plDatabase[jobId].machine = machine;
        plDatabase[jobId].isComplete = isNowComplete;
    }
    
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
    if (plDatabase[jobId]) Object.assign(plDatabase[jobId], additionalFields);
    
    jobSpeeds[jobId] = speed;
    if (plDatabase[jobId]) {
        plDatabase[jobId].machineSpeed = speed;
        plDatabase[jobId].plannedSpeed = speed;
        plDatabase[jobId].actualSpeed = speed;
    }
    
    // ⭐ CRITICAL: If job is marked as Complete, update the schedule to mark it as printed
    if (isNowComplete && isOnTimeline && jobSchedule[jobId]) {
        jobSchedule[jobId].isPrinted = true;
        // Also update the end time to now if it hasn't been set
        if (jobSchedule[jobId].endTime > Date.now()) {
            jobSchedule[jobId].endTime = Date.now();
        }
        console.log(`✅ Job ${jobId} marked as printed in schedule`);
        
        // Add printed class to the job element
        if (timelineJob) {
            timelineJob.classList.add('job-printed');
            timelineJob.setAttribute('draggable', 'false');
            
            // Disable inputs
            const inputs = timelineJob.querySelectorAll('.job-editable-fields input');
            inputs.forEach(input => {
                input.disabled = true;
                input.style.backgroundColor = '#e9ecef';
                input.style.cursor = 'not-allowed';
                input.style.opacity = '0.7';
            });
        }
    }
    
    // If job was marked as Complete and is on timeline, remove other printed jobs
    if (isNowComplete && isOnTimeline) {
        const timeline = timelineJob?.parentElement;
        if (timeline) {
            const allPrinted = timeline.querySelectorAll('.job.job-printed');
            if (allPrinted.length > 1) {
                // Keep only the most recent (this one) and remove others
                const toRemove = Array.from(allPrinted).filter(job => 
                    job.getAttribute('data-job-id') !== jobId
                );
                toRemove.forEach(job => {
                    const id = job.getAttribute('data-job-id');
                    delete jobSchedule[id];
                    job.remove();
                    console.log(`🗑️ Removed old printed job ${id} from timeline`);
                });
            }
        }
    }
    
    if (isOnTimeline && machine) {
        const currentTimeline = timelineJob.parentElement;
        const targetTimelineId = `timeline-${machine}`;
        const targetTimeline = document.getElementById(targetTimelineId);
        if (targetTimeline && currentTimeline && currentTimeline.id !== targetTimelineId) {
            timelineJob.remove();
            const printedJobs = targetTimeline.querySelectorAll('.job.job-printed');
            if (printedJobs.length > 0) {
                targetTimeline.insertBefore(timelineJob, printedJobs[0]);
            } else {
                targetTimeline.appendChild(timelineJob);
            }
            if (jobSchedule[jobId]) jobSchedule[jobId].timelineId = targetTimelineId;
            rescheduleTimelineJobs(currentTimeline.id);
            rescheduleTimelineJobs(targetTimelineId);
            scaleTimeline(currentTimeline.id);
            scaleTimeline(targetTimelineId);
            updateMachineStatus(currentTimeline.closest('.machine'));
            updateMachineStatus(targetTimeline.closest('.machine'));
            updateAllJobTimes();
            updateAllJobColors();
        }
    } else if (!isOnTimeline && machine && plStatus === 'Planned') {
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
    } else if (isOnTimeline && plStatus !== 'Planned' && plStatus !== 'Complete') {
        if (!timelineJob.classList.contains('job-printed')) {
            const feedItem = document.querySelector(`.feed-job[data-job-id="${jobId}"]`);
            if (!feedItem) {
                returnJobToFeed(timelineJob);
                showNotification(`↩️ "${name}" removed from timeline (status: ${plStatus})`, 'info');
            }
        }
    }
    
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
    if (document.querySelector(`.job[data-job-id="${jobId}"]`)) {
        showNotification('⚠️ Job is already on the timeline', 'warning');
        return;
    }
    const machineSelect = document.getElementById('modal-machine');
    const machine = machineSelect ? machineSelect.value : '';
    if (!machine) {
        showNotification('⚠️ Please assign a machine first', 'warning');
        return;
    }
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
    
    const timelineBadge = document.getElementById('modal-on-timeline');
    if (timelineBadge) {
        timelineBadge.textContent = 'Yes';
        timelineBadge.className = 'modal-badge badge-yes';
    }
    const removeBtn = document.getElementById('modal-remove-from-timeline');
    const addBtn = document.getElementById('modal-add-to-timeline');
    if (removeBtn) removeBtn.style.display = 'inline-block';
    if (addBtn) addBtn.style.display = 'none';
    
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
    const plStatusSelect = document.getElementById('modal-pl-status');
    if (plStatusSelect) plStatusSelect.value = 'Unplanned';
    jobData.planningStatus = 'Unplanned';
    returnJobToFeed(timelineJob);
    
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

// Add CSS for modal
const styleForModal = document.createElement('style');
styleForModal.textContent = `
    .feed-job-selected {
        background: linear-gradient(135deg, #e3f2fd, #bbdefb) !important;
        border-left: 4px solid #1976d2 !important;
        box-shadow: 0 2px 12px rgba(25, 118, 210, 0.2) !important;
    }
`;
document.head.appendChild(styleForModal);

// Setup modal triggers
document.addEventListener('DOMContentLoaded', function() {
    setupModalEventListeners();
    setupModalClickTriggers();
    addModalInstructions();
});

window.openJobDetailsModal = openJobDetailsModal;
window.closeJobDetailsModal = closeJobDetailsModal;
window.saveJobDetailsFromModal = saveJobDetailsFromModal;
window.addJobToTimelineFromModal = addJobToTimelineFromModal;
window.removeJobFromTimelineFromModal = removeJobFromTimelineFromModal;
