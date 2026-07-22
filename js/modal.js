// script-modal.js
// ============================================================
// JOB DETAILS MODAL - WITH START/END TIME EDITING
// ============================================================

let currentModalJobId = null;

// ============================================================
// FORMAT DATE FOR DATETIME-LOCAL INPUT
// ============================================================
function formatDateTimeLocal(date) {
    if (!date || isNaN(date.getTime())) return '';
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
}

// ============================================================
// SETUP MODAL EVENT LISTENERS
// ============================================================
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
    
    // ⭐ Apply Time button
    const applyTimeBtn = document.getElementById('modal-apply-time-btn');
    if (applyTimeBtn) {
        applyTimeBtn.addEventListener('click', function() {
            if (!currentModalJobId) {
                showNotification('❌ No job selected', 'error');
                return;
            }
            // Save just the time changes
            saveJobTimeOnly();
        });
    }
    
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

// ============================================================
// SETUP MODAL CLICK TRIGGERS
// ============================================================
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

// ============================================================
// ADD MODAL INSTRUCTIONS
// ============================================================
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

// ============================================================
// OPEN JOB DETAILS MODAL
// ============================================================
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
    // ESTIMATED DATE HANDLING
    // ============================================================
    const estimatedDateInput = document.getElementById('modal-estimated-date');
    const estimatedContainer = document.getElementById('modal-estimated-date-container');
    
    if (estimatedDateInput && estimatedContainer) {
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
    
    // ============================================================
    // START AND END TIMES - WITH INPUT FIELDS
    // ============================================================
    const startTimeInput = document.getElementById('modal-start-time-input');
    const endTimeInput = document.getElementById('modal-end-time-input');
    const durationEl = document.getElementById('modal-duration');
    const applyTimeBtn = document.getElementById('modal-apply-time-btn');
    
    if (jobSchedule[jobId]) {
        const startTime = new Date(jobSchedule[jobId].startTime);
        const endTime = new Date(jobSchedule[jobId].endTime);
        
        // Format for datetime-local input
        if (startTimeInput) {
            startTimeInput.value = formatDateTimeLocal(startTime);
            startTimeInput.disabled = false;
        }
        if (endTimeInput) {
            endTimeInput.value = formatDateTimeLocal(endTime);
            endTimeInput.disabled = false;
        }
        if (applyTimeBtn) {
            applyTimeBtn.style.display = 'inline-block';
        }
        
        const duration = Math.round((endTime - startTime) / 60000);
        if (durationEl) durationEl.textContent = `${duration} minutes`;
    } else {
        if (startTimeInput) {
            startTimeInput.value = '';
            startTimeInput.disabled = true;
        }
        if (endTimeInput) {
            endTimeInput.value = '';
            endTimeInput.disabled = true;
        }
        if (applyTimeBtn) {
            applyTimeBtn.style.display = 'none';
        }
        if (durationEl) durationEl.textContent = 'Not scheduled';
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

// ============================================================
// CLOSE JOB DETAILS MODAL
// ============================================================
function closeJobDetailsModal() {
    const modal = document.getElementById('job-details-modal');
    if (modal) modal.classList.remove('active');
    document.body.style.overflow = '';
    document.querySelectorAll('.job-selected, .feed-job-selected').forEach(el => {
        el.classList.remove('job-selected', 'feed-job-selected');
    });
    currentModalJobId = null;
    
    // Reset time inputs
    const startInput = document.getElementById('modal-start-time-input');
    const endInput = document.getElementById('modal-end-time-input');
    if (startInput) startInput.value = '';
    if (endInput) endInput.value = '';
}

// ============================================================
// SAVE JOB TIME ONLY (for the Apply Time button)
// ============================================================
async function saveJobTimeOnly() {
    if (!currentModalJobId) {
        showNotification('❌ No job selected', 'error');
        return;
    }
    
    const jobId = currentModalJobId;
    const startTimeInput = document.getElementById('modal-start-time-input');
    const endTimeInput = document.getElementById('modal-end-time-input');
    
    if (!startTimeInput || !endTimeInput || !startTimeInput.value || !endTimeInput.value) {
        showNotification('⚠️ Job is not on a timeline', 'warning');
        return;
    }
    
    const newStartTime = new Date(startTimeInput.value).getTime();
    const newEndTime = new Date(endTimeInput.value).getTime();
    
    if (isNaN(newStartTime) || isNaN(newEndTime) || newEndTime <= newStartTime) {
        showNotification('⚠️ Invalid time range', 'warning');
        return;
    }
    
    // Check if job is on timeline
    const timelineJob = document.querySelector(`.job[data-job-id="${jobId}"]`);
    if (!timelineJob) {
        showNotification('⚠️ Job is not on a timeline', 'warning');
        return;
    }
    
    try {
        // Update schedule in memory
        if (jobSchedule[jobId]) {
            jobSchedule[jobId].startTime = newStartTime;
            jobSchedule[jobId].endTime = newEndTime;
            
            // Save to Supabase
            const scheduleData = {
                start_time: new Date(newStartTime).toISOString(),
                end_time: new Date(newEndTime).toISOString(),
                timeline_id: jobSchedule[jobId].timelineId,
                is_printed: jobSchedule[jobId].isPrinted || false
            };
            
            const saved = await supabaseSaveSchedule(jobId, scheduleData);
            if (saved) {
                console.log(`✅ Schedule saved to Supabase for ${jobId}`);
            } else {
                // Try batch save as fallback
                const scheduleMap = {};
                scheduleMap[jobId] = scheduleData;
                await supabaseSaveMultipleSchedules(scheduleMap);
            }
            
            // Update the timeline display
            updateJobTimeDisplay(jobId);
            
            // Reschedule the timeline
            const timeline = timelineJob.parentElement;
            if (timeline) {
                rescheduleTimelineJobs(timeline.id, true);
                debouncedScaleTimeline(timeline.id);
                updateAllJobColors();
                applySmartZoom();
            }
            
            // Update duration display
            const durationEl = document.getElementById('modal-duration');
            if (durationEl) {
                const duration = Math.round((newEndTime - newStartTime) / 60000);
                durationEl.textContent = `${duration} minutes`;
            }
            
            // Trigger auto-save
            if (typeof scheduleAutoSave === 'function') {
                scheduleAutoSave();
            }
            
            showNotification(`✅ Time updated: ${new Date(newStartTime).toLocaleTimeString()} → ${new Date(newEndTime).toLocaleTimeString()}`, 'success');
        }
    } catch (error) {
        console.error('❌ Error saving time:', error);
        showNotification('❌ Failed to save time: ' + error.message, 'error');
    }
}

// ============================================================
// SAVE JOB DETAILS FROM MODAL
// ============================================================
async function saveJobDetailsFromModal() {
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
        if (jobSchedule[jobId].endTime > Date.now()) {
            jobSchedule[jobId].endTime = Date.now();
        }
        console.log(`✅ Job ${jobId} marked as printed in schedule`);
        
        if (timelineJob) {
            timelineJob.classList.add('job-printed');
            timelineJob.setAttribute('draggable', 'false');
            
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
    
    // ============================================================
    // HANDLE START/END TIME UPDATES
    // ============================================================
    const startTimeInput = document.getElementById('modal-start-time-input');
    const endTimeInput = document.getElementById('modal-end-time-input');
    
    if (startTimeInput && endTimeInput && startTimeInput.value && endTimeInput.value) {
        const newStartTime = new Date(startTimeInput.value).getTime();
        const newEndTime = new Date(endTimeInput.value).getTime();
        
        if (!isNaN(newStartTime) && !isNaN(newEndTime) && newEndTime > newStartTime) {
            // Update the schedule
            if (jobSchedule[jobId]) {
                jobSchedule[jobId].startTime = newStartTime;
                jobSchedule[jobId].endTime = newEndTime;
                
                // ⭐ CRITICAL: Save schedule to Supabase immediately
                try {
                    const scheduleData = {
                        start_time: new Date(newStartTime).toISOString(),
                        end_time: new Date(newEndTime).toISOString(),
                        timeline_id: jobSchedule[jobId].timelineId,
                        is_printed: jobSchedule[jobId].isPrinted || false
                    };
                    
                    const saved = await supabaseSaveSchedule(jobId, scheduleData);
                    if (saved) {
                        console.log(`✅ Schedule saved to Supabase for ${jobId}`);
                    } else {
                        // Try batch save as fallback
                        const scheduleMap = {};
                        scheduleMap[jobId] = scheduleData;
                        await supabaseSaveMultipleSchedules(scheduleMap);
                    }
                } catch (error) {
                    console.error('❌ Error saving schedule:', error);
                    // Try batch save as fallback
                    try {
                        const scheduleMap = {};
                        scheduleMap[jobId] = {
                            start_time: new Date(newStartTime).toISOString(),
                            end_time: new Date(newEndTime).toISOString(),
                            timeline_id: jobSchedule[jobId].timelineId,
                            is_printed: jobSchedule[jobId].isPrinted || false
                        };
                        await supabaseSaveMultipleSchedules(scheduleMap);
                    } catch (e) {
                        console.error('❌ Fallback save also failed:', e);
                    }
                }
                
                // Update the timeline display
                const updatedTimelineJob = document.querySelector(`.job[data-job-id="${jobId}"]`);
                if (updatedTimelineJob) {
                    updateJobTimeDisplay(jobId);
                }
                
                // Reschedule the timeline
                const timeline = updatedTimelineJob?.parentElement;
                if (timeline) {
                    rescheduleTimelineJobs(timeline.id, true);
                    debouncedScaleTimeline(timeline.id);
                    updateAllJobColors();
                    applySmartZoom();
                }
                
                // Update duration display
                const durationEl = document.getElementById('modal-duration');
                if (durationEl) {
                    const duration = Math.round((newEndTime - newStartTime) / 60000);
                    durationEl.textContent = `${duration} minutes`;
                }
                
                // Trigger auto-save
                if (typeof scheduleAutoSave === 'function') {
                    scheduleAutoSave();
                }
                
                console.log(`✅ Updated schedule for ${jobId}: ${new Date(newStartTime).toLocaleString()} → ${new Date(newEndTime).toLocaleString()}`);
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
    
    // ⭐ CRITICAL: Force immediate save to Supabase when job is marked as Complete
    if (isNowComplete) {
        console.log('🔄 Force saving completed job to Supabase...');
        setTimeout(async () => {
            try {
                const jobDataToSave = convertCamelToSnake(jobData);
                jobDataToSave.job_id = jobId;
                await supabaseSaveJob(jobId, jobDataToSave);
                
                if (jobSchedule[jobId]) {
                    const scheduleData = {
                        start_time: new Date(jobSchedule[jobId].startTime).toISOString(),
                        end_time: new Date(jobSchedule[jobId].endTime).toISOString(),
                        timeline_id: jobSchedule[jobId].timelineId,
                        is_printed: true
                    };
                    await supabaseSaveSchedule(jobId, scheduleData);
                    console.log(`✅ Completed job ${jobId} saved to Supabase`);
                }
            } catch (error) {
                console.error('❌ Error saving completed job:', error);
            }
        }, 100);
    }
}

// ============================================================
// ADD JOB TO TIMELINE FROM MODAL
// ============================================================
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
    
    // Enable time inputs
    const startTimeInput = document.getElementById('modal-start-time-input');
    const endTimeInput = document.getElementById('modal-end-time-input');
    const applyTimeBtn = document.getElementById('modal-apply-time-btn');
    
    if (jobSchedule[jobId]) {
        const startTime = new Date(jobSchedule[jobId].startTime);
        const endTime = new Date(jobSchedule[jobId].endTime);
        
        if (startTimeInput) {
            startTimeInput.value = formatDateTimeLocal(startTime);
            startTimeInput.disabled = false;
        }
        if (endTimeInput) {
            endTimeInput.value = formatDateTimeLocal(endTime);
            endTimeInput.disabled = false;
        }
        if (applyTimeBtn) {
            applyTimeBtn.style.display = 'inline-block';
        }
        
        const durationEl = document.getElementById('modal-duration');
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

// ============================================================
// REMOVE JOB FROM TIMELINE FROM MODAL
// ============================================================
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
    
    // Disable time inputs
    const startTimeInput = document.getElementById('modal-start-time-input');
    const endTimeInput = document.getElementById('modal-end-time-input');
    const applyTimeBtn = document.getElementById('modal-apply-time-btn');
    
    if (startTimeInput) {
        startTimeInput.value = '';
        startTimeInput.disabled = true;
    }
    if (endTimeInput) {
        endTimeInput.value = '';
        endTimeInput.disabled = true;
    }
    if (applyTimeBtn) {
        applyTimeBtn.style.display = 'none';
    }
    
    const durationEl = document.getElementById('modal-duration');
    if (durationEl) durationEl.textContent = 'Not scheduled';
    
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
// ADD CSS FOR MODAL
// ============================================================
const styleForModal = document.createElement('style');
styleForModal.textContent = `
    .feed-job-selected {
        background: linear-gradient(135deg, #e3f2fd, #bbdefb) !important;
        border-left: 4px solid #1976d2 !important;
        box-shadow: 0 2px 12px rgba(25, 118, 210, 0.2) !important;
    }
    
    /* Time input styles */
    #modal-start-time-input,
    #modal-end-time-input {
        font-family: inherit;
        font-size: 13px;
        padding: 6px 10px;
        border-radius: 4px;
        border: 1px solid #ced4da;
        background: white;
        width: 100%;
        box-sizing: border-box;
    }
    
    #modal-start-time-input:disabled,
    #modal-end-time-input:disabled {
        background: #e9ecef;
        color: #6c757d;
        cursor: not-allowed;
    }
    
    #modal-start-time-input:focus,
    #modal-end-time-input:focus {
        border-color: #3498db;
        outline: none;
        box-shadow: 0 0 0 3px rgba(52, 152, 219, 0.15);
    }
    
    .modal-btn-sm {
        padding: 6px 12px;
        font-size: 12px;
        border-radius: 4px;
        border: 1px solid #3498db;
        background: #3498db;
        color: white;
        cursor: pointer;
        white-space: nowrap;
    }
    
    .modal-btn-sm:hover {
        background: #2980b9;
        border-color: #2980b9;
    }
    
    .modal-time-row {
        display: flex;
        gap: 8px;
        align-items: center;
    }
    
    .modal-time-row .modal-field {
        flex: 1;
        margin-bottom: 0;
    }
    
    .modal-time-row .modal-field label {
        display: block;
        font-size: 11px;
        font-weight: 600;
        color: #495057;
        margin-bottom: 2px;
    }
    
    .modal-time-row .modal-field input {
        width: 100%;
    }
`;
document.head.appendChild(styleForModal);

// ============================================================
// SETUP MODAL TRIGGERS
// ============================================================
document.addEventListener('DOMContentLoaded', function() {
    setupModalEventListeners();
    setupModalClickTriggers();
    addModalInstructions();
});

// ============================================================
// EXPOSE FUNCTIONS TO WINDOW
// ============================================================
window.openJobDetailsModal = openJobDetailsModal;
window.closeJobDetailsModal = closeJobDetailsModal;
window.saveJobDetailsFromModal = saveJobDetailsFromModal;
window.saveJobTimeOnly = saveJobTimeOnly;
window.addJobToTimelineFromModal = addJobToTimelineFromModal;
window.removeJobFromTimelineFromModal = removeJobFromTimelineFromModal;
window.formatDateTimeLocal = formatDateTimeLocal;

console.log('✅ modal.js loaded - Complete with time editing and Supabase save');
