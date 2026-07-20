// script-main.js
// ============================================================
// MAIN APPLICATION INITIALIZATION
// ============================================================

document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded - initializing app');
    initializeApp();
});

// ============================================================
// INITIALIZE APP - WITH SUPABASE
// ============================================================
async function initializeApp() {
    console.log('Initializing application...');
    
    // ============================================================
    // STEP 1: Initialize Supabase and load data
    // ============================================================
    try {
        console.log('🔄 Loading data from Supabase...');
        const success = await supabaseSyncAllData();
        if (success) {
            console.log('✅ Data loaded successfully from Supabase');
            showNotification('✅ Data loaded from database', 'success');
        } else {
            console.warn('⚠️ Using fallback data (Supabase unavailable)');
            showNotification('⚠️ Using local data - Supabase unavailable', 'warning');
        }
    } catch (error) {
        console.error('❌ Failed to load data from Supabase:', error);
        showNotification('⚠️ Using local data - connection error', 'error');
    }
    
    // ============================================================
    // STEP 1.5: Rebuild timelines from loaded schedules
    // ============================================================
    rebuildTimelinesFromSchedules();
    
    // Initialize time display
    updateTime();
    setInterval(updateTime, 60000);
    
    // Populate production feed with initial jobs
    populateProductionFeed();
    
    // Initialize machine elements
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
    
    // Setup now indicator persistence
    setupNowIndicatorPersistence();
    setupResizeObserver();
    
    // Apply initial zoom
    setTimeout(() => {
        applySmartZoom();
    }, 200);
    
    // Start timeline scrolling
    startTimelineScrolling();
    
    // Setup modal event listeners
    setupModalEventListeners();
    
    // Initialize timeline rulers
    setTimeout(initializeTimelineRulers, 1000);
    
    // Start upload status monitoring
    startUploadStatusMonitoring();
    
    // Update real-time clock
    updateRealTimeIndicator();
    setInterval(updateRealTimeIndicator, 1000);
    
    // ============================================================
    // STEP 2: Setup auto-save after data loads
    // ============================================================
    setupAutoSaveTriggers();
    
    console.log('Application initialized successfully');
}

// ============================================================
// REBUILD TIMELINES FROM SCHEDULES
// ============================================================
// ============================================================
// REBUILD TIMELINES FROM SCHEDULES - FIXED
// ============================================================
function rebuildTimelinesFromSchedules() {
    console.log('🔄 Rebuilding timelines from schedules...');
    
    const scheduleEntries = Object.entries(jobSchedule);
    console.log(`📊 Found ${scheduleEntries.length} schedules in memory`);
    
    if (scheduleEntries.length === 0) {
        console.log('⚠️ No schedules found in memory');
        return;
    }
    
    // Clear existing timeline jobs first (keep printed jobs)
    document.querySelectorAll('.timeline').forEach(timeline => {
        const jobs = timeline.querySelectorAll('.job:not(.job-printed)');
        jobs.forEach(job => {
            const jobId = job.getAttribute('data-job-id');
            delete jobSchedule[jobId];
            job.remove();
        });
    });
    
    // Group schedules by timeline
    const groupedByTimeline = {};
    for (const [jobId, schedule] of scheduleEntries) {
        const timelineId = schedule.timelineId;
        if (!groupedByTimeline[timelineId]) {
            groupedByTimeline[timelineId] = [];
        }
        groupedByTimeline[timelineId].push({ jobId, schedule });
    }
    
    // Sort each timeline by start time
    for (const [timelineId, jobs] of Object.entries(groupedByTimeline)) {
        jobs.sort((a, b) => a.schedule.startTime - b.schedule.startTime);
        
        const timeline = document.getElementById(timelineId);
        if (!timeline) {
            console.warn(`⚠️ Timeline ${timelineId} not found in DOM`);
            continue;
        }
        
        console.log(`📊 Adding ${jobs.length} jobs to ${timelineId}`);
        
        // ⭐ Get existing printed jobs on this timeline
        const existingPrinted = timeline.querySelectorAll('.job.job-printed');
        
        // ⭐ For each printed job, check if it's the most recent one
        // If there are multiple printed jobs, keep only the most recent
        const printedWithTimes = [];
        existingPrinted.forEach(job => {
            const id = job.getAttribute('data-job-id');
            const endTime = jobSchedule[id]?.endTime || 0;
            printedWithTimes.push({ job, id, endTime });
        });
        
        // Sort printed jobs by end time (most recent first)
        printedWithTimes.sort((a, b) => b.endTime - a.endTime);
        
        // Remove all but the most recent printed job
        const toRemove = printedWithTimes.slice(1);
        toRemove.forEach(({ job, id }) => {
            delete jobSchedule[id];
            job.remove();
            console.log(`🗑️ Removed old printed job ${id} from ${timelineId}`);
        });
        
        // Add non-printed jobs
        let printedCount = 0;
        for (const { jobId, schedule } of jobs) {
            const jobData = jobDatabase[jobId];
            if (!jobData) {
                console.warn(`⚠️ Job data not found for ${jobId}`);
                continue;
            }
            
            // ⭐ Skip if this is a printed job and we already have one
            if (schedule.isPrinted) {
                printedCount++;
                if (printedCount > 1) {
                    console.log(`⚠️ Skipping extra printed job ${jobId}`);
                    delete jobSchedule[jobId];
                    continue;
                }
            }
            
            // Check if already on timeline
            const existing = timeline.querySelector(`.job[data-job-id="${jobId}"]`);
            if (existing) continue;
            
            // Create the job element
            const jobElement = createJobElement(jobId, jobData);
            
            // Insert before printed jobs
            const firstPrinted = timeline.querySelector('.job.job-printed');
            if (firstPrinted) {
                timeline.insertBefore(jobElement, firstPrinted);
            } else {
                timeline.appendChild(jobElement);
            }
            
            // Update the time display
            updateJobTimeDisplay(jobId);
        }
    }
    
    // Update all timelines
    document.querySelectorAll('.timeline').forEach(timeline => {
        // ⭐ After rebuilding, ensure only 1 printed job remains per timeline
        const printedJobs = timeline.querySelectorAll('.job.job-printed');
        if (printedJobs.length > 1) {
            const toRemove = Array.from(printedJobs).slice(0, printedJobs.length - 1);
            toRemove.forEach(job => {
                const jobId = job.getAttribute('data-job-id');
                delete jobSchedule[jobId];
                job.remove();
                console.log(`🗑️ Cleaned up extra printed job ${jobId}`);
            });
        }
        
        debouncedScaleTimeline(timeline.id);
        updateJobColors(timeline.id);
        updateMachineStatus(timeline.closest('.machine'));
    });
    
    updateAllMachineStatuses();
    updateAllJobColors();
    updateAllJobTimes();
    updateAllNowIndicators();
    updateStatistics();
    applySmartZoom();
    setTimeout(() => updateAllTimelineScrollPositions(), 300);
    
    console.log('✅ Timelines rebuilt from schedules - Only 1 printed job kept per timeline');
}
// ============================================================
// AUTO-SAVE TRIGGERS
// ============================================================
function setupAutoSaveTriggers() {
    console.log('🔄 Setting up auto-save triggers...');
    
    // Save when jobs are added/removed from timeline
    const originalAddJob = window.addJobToTimelineWithSchedule;
    if (originalAddJob) {
        window.addJobToTimelineWithSchedule = function(...args) {
            const result = originalAddJob.apply(this, args);
            scheduleAutoSave();
            return result;
        };
    }
    
    // Save when job is returned to feed
    const originalReturnJob = window.returnJobToFeed;
    if (originalReturnJob) {
        window.returnJobToFeed = function(...args) {
            const result = originalReturnJob.apply(this, args);
            scheduleAutoSave();
            return result;
        };
    }
    
    // Save when job details are saved from modal
    const originalSaveJob = window.saveJobDetailsFromModal;
    if (originalSaveJob) {
        window.saveJobDetailsFromModal = function(...args) {
            const result = originalSaveJob.apply(this, args);
            scheduleAutoSave();
            return result;
        };
    }
    
    // Save when job setup/quantity/speed is updated
    const originalUpdateSetup = window.updateJobSetup;
    if (originalUpdateSetup) {
        window.updateJobSetup = function(...args) {
            const result = originalUpdateSetup.apply(this, args);
            scheduleAutoSave();
            return result;
        };
    }
    
    const originalUpdateQuantity = window.updateJobQuantity;
    if (originalUpdateQuantity) {
        window.updateJobQuantity = function(...args) {
            const result = originalUpdateQuantity.apply(this, args);
            scheduleAutoSave();
            return result;
        };
    }
    
    const originalUpdateSpeed = window.updateJobSpeed;
    if (originalUpdateSpeed) {
        window.updateJobSpeed = function(...args) {
            const result = originalUpdateSpeed.apply(this, args);
            scheduleAutoSave();
            return result;
        };
    }
    
    // Save when PL status changes
    const originalUpdatePLStatus = window.updateJobPLStatus;
    if (originalUpdatePLStatus) {
        window.updateJobPLStatus = function(...args) {
            const result = originalUpdatePLStatus.apply(this, args);
            scheduleAutoSave();
            return result;
        };
    }
    
    console.log('✅ Auto-save triggers configured');
}

// ============================================================
// MACHINE ELEMENTS
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

function initializeTimelineRulers() {
    setTimeout(() => {
        document.querySelectorAll('.timeline').forEach(timeline => {
            const jobs = timeline.querySelectorAll('.job');
            if (jobs.length > 0) {
                scaleTimeline(timeline.id);
            }
        });
    }, 500);
}

// ============================================================
// EVENT LISTENERS
// ============================================================
function setupEventListeners() {
    console.log('Setting up event listeners...');
    
    const addJobBtn = document.getElementById('add-job');
    if (addJobBtn) addJobBtn.addEventListener('click', handleAddJob);
    
    const jobSearch = document.getElementById('job-search');
    if (jobSearch) jobSearch.addEventListener('input', handleSearch);
    
    const filterBtn = document.querySelector('.filter-btn');
    if (filterBtn) filterBtn.addEventListener('click', toggleFilterPanel);
    
    document.addEventListener('keydown', handleKeydown);
    document.addEventListener('click', handleClickOutside);
    
    // Setup drag and drop
    setupDragAndDrop();
    
    // Setup Excel uploads
    console.log('Calling setupExcelUploads...');
    setupExcelUploads();
    
// In main.js - Update the click handler for timeline jobs

// In main.js - Replace the click handler for feed jobs

document.addEventListener('click', function(e) {
    const feedJob = e.target.closest('.feed-job');
    if (feedJob) {
        // Don't trigger if clicking on inputs, buttons, or status elements
        if (e.target.closest('input') || e.target.closest('button') || 
            e.target.closest('.feed-status') || e.target.closest('.feed-pl-status')) {
            return;
        }
        const jobId = feedJob.getAttribute('data-job-id');
        if (jobId) {
            e.stopPropagation();
            const jobData = jobDatabase[jobId];
            
            // ✅ If the job is Planned and on timeline, show it on the timeline
            if (jobData && jobData.planningStatus === 'Planned') {
                const isOnTimeline = !!document.querySelector(`.job[data-job-id="${jobId}"]`);
                if (isOnTimeline) {
                    console.log('Planned feed job clicked - showing on timeline:', jobId);
                    showJobOnTimeline(jobId);
                } else {
                    // If Planned but not on timeline (shouldn't happen, but just in case)
                    console.log('Planned job not on timeline yet - opening modal:', jobId);
                    openJobDetailsModal(jobId);
                }
            } else {
                // Otherwise open the modal
                console.log('Feed job clicked - opening modal:', jobId);
                openJobDetailsModal(jobId);
            }
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
            const jobData = jobDatabase[jobId];
            
            // ✅ If the job is Planned, show it on the timeline
            if (jobData && jobData.planningStatus === 'Planned') {
                console.log('Planned job clicked - showing on timeline:', jobId);
                showJobOnTimeline(jobId);
            } else {
                // Otherwise open the modal
                console.log('Timeline job clicked:', jobId);
                openJobDetailsModal(jobId);
            }
        }
    }
});
}

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
    
    const filterPanel = document.getElementById('filter-panel');
    if (filterPanel && filterPanel.classList.contains('active')) {
        if (!e.target.closest('.filter-panel') && !e.target.closest('.filter-btn')) {
            filterPanel.classList.remove('active');
        }
    }
}

// ============================================================
// DRAG AND DROP
// ============================================================
function setupDragAndDrop() {
    console.log('Setting up drag and drop with enhanced features...');
    
    let dragScrollInterval = null;
    let currentDragContainer = null;
    const SCROLL_SPEED = 20;
    const SCROLL_MARGIN = 60;
    
    document.addEventListener('dragstart', function(e) {
        const target = e.target.closest('.feed-job, .job');
        if (target) {
            const jobId = target.getAttribute('data-job-id');
            if (target.classList.contains('feed-job')) {
                const isOnTimeline = checkJobOnTimeline(jobId);
                if (isOnTimeline) {
                    target.classList.add('job-already-on-timeline');
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
        if (dragScrollInterval) {
            clearInterval(dragScrollInterval);
            dragScrollInterval = null;
        }
        currentDragContainer = null;
    });
    
    document.querySelectorAll('.timeline-container').forEach(container => {
        container.addEventListener('dragover', function(e) {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            
            const rect = this.getBoundingClientRect();
            const mouseX = e.clientX;
            
            if (dragScrollInterval) {
                clearInterval(dragScrollInterval);
                dragScrollInterval = null;
            }
            
            if (mouseX < rect.left + SCROLL_MARGIN) {
                dragScrollInterval = setInterval(() => {
                    this.scrollLeft -= SCROLL_SPEED;
                }, 16);
            } else if (mouseX > rect.right - SCROLL_MARGIN) {
                dragScrollInterval = setInterval(() => {
                    this.scrollLeft += SCROLL_SPEED;
                }, 16);
            }
            
            currentDragContainer = this;
        });
        
        container.addEventListener('dragleave', function(e) {
            if (!this.contains(e.relatedTarget)) {
                if (dragScrollInterval) {
                    clearInterval(dragScrollInterval);
                    dragScrollInterval = null;
                }
            }
        });
    });
    
    document.querySelectorAll('.timeline').forEach(timeline => {
        const container = timeline.closest('.timeline-container');
        if (!container) return;
        
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
            
            if (dragScrollInterval) {
                clearInterval(dragScrollInterval);
                dragScrollInterval = null;
            }
            
            if (draggedElement) {
                const jobId = draggedElement.getAttribute('data-job-id');
                
                if (draggedElement.classList.contains('feed-job')) {
                    const existingJob = document.querySelector(`.job[data-job-id="${jobId}"]`);
                    if (existingJob) {
                        const jobName = jobDatabase[jobId]?.name || jobId;
                        showNotification(`⚠️ "${jobName}" is already on the timeline!`, 'warning');
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
                
                sortPrintedJobs(this);
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
    return !!document.querySelector(`.job[data-job-id="${jobId}"]`);
}

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

// main.js - Updated handleFeedToTimeline function
function handleFeedToTimeline(jobId, timeline, e) {
    const existingJobOnTimeline = document.querySelector(`.job[data-job-id="${jobId}"]`);
    if (existingJobOnTimeline) {
        showNotification(`⚠️ Job "${jobDatabase[jobId]?.name || jobId}" is already on the timeline!`, 'warning');
        return;
    }
    if (!jobDatabase[jobId]) {
        showNotification(`❌ Job "${jobId}" not found in database!`, 'error');
        return;
    }
    
    updateJobPLStatus(jobId, 'Planned');
    
    const machineNumber = timeline.id.replace('timeline-', '');
    
    if (jobDatabase[jobId]) {
        jobDatabase[jobId].machine = machineNumber;
    }
    if (plDatabase[jobId]) {
        plDatabase[jobId].machine = machineNumber;
    }
    
    const activeJobs = timeline.querySelectorAll('.job:not(.job-printed)');
    let newStartTime;
    let insertBeforeElement = null;
    
    if (activeJobs.length > 0) {
        const afterElement = getDragAfterElement(timeline, e.clientX);
        
        if (afterElement) {
            insertBeforeElement = afterElement;
            const insertIndex = Array.from(timeline.children).indexOf(afterElement);
            
            let prevJob = null;
            for (let i = insertIndex - 1; i >= 0; i--) {
                const child = timeline.children[i];
                if (child.classList.contains('job') && !child.classList.contains('job-dragging')) {
                    prevJob = child;
                    break;
                }
            }
            
            if (prevJob && prevJob.classList.contains('job') && !prevJob.classList.contains('job-printed')) {
                const prevJobId = prevJob.getAttribute('data-job-id');
                newStartTime = jobSchedule[prevJobId]?.endTime || new Date().getTime();
            } else {
                const printedJobs = timeline.querySelectorAll('.job.job-printed');
                if (printedJobs.length > 0) {
                    const lastPrinted = printedJobs[printedJobs.length - 1];
                    const lastPrintedId = lastPrinted.getAttribute('data-job-id');
                    newStartTime = jobSchedule[lastPrintedId]?.endTime || new Date().getTime();
                } else {
                    newStartTime = new Date().getTime();
                }
            }
        } else {
            const lastJob = activeJobs[activeJobs.length - 1];
            const lastJobId = lastJob.getAttribute('data-job-id');
            newStartTime = jobSchedule[lastJobId]?.endTime || new Date().getTime();
        }
    } else {
        const printedJobs = timeline.querySelectorAll('.job.job-printed');
        if (printedJobs.length > 0) {
            const lastPrinted = printedJobs[printedJobs.length - 1];
            const lastPrintedId = lastPrinted.getAttribute('data-job-id');
            newStartTime = jobSchedule[lastPrintedId]?.endTime || new Date().getTime();
        } else {
            newStartTime = new Date().getTime();
        }
    }
    
    addJobToTimelineWithSchedule(jobId, timeline.id, newStartTime, insertBeforeElement);
    rescheduleTimelineJobs(timeline.id);
    updateAllJobColors();
    updateStatistics();
    applySmartZoom();
    
    const jobName = jobDatabase[jobId]?.name || jobId;
    showNotification(`✅ "${jobName}" added to Machine ${machineNumber} (PL: Planned)`, 'success');
    setTimeout(() => updateAllTimelineScrollPositions(), 300);
}

// main.js - Updated handleJobReorder function
function handleJobReorder(jobId, targetTimeline, e) {
    const oldTimeline = draggedElement.parentElement;
    const afterElement = getDragAfterElement(targetTimeline, e.clientX);
    let insertBeforeElement = null;
    let newStartTime;
    
    draggedElement.remove();
    
    const machineNumber = targetTimeline.id.replace('timeline-', '');
    
    if (jobDatabase[jobId]) {
        jobDatabase[jobId].machine = machineNumber;
    }
    if (plDatabase[jobId]) {
        plDatabase[jobId].machine = machineNumber;
    }
    
    const activeJobs = targetTimeline.querySelectorAll('.job:not(.job-printed)');
    
    if (afterElement) {
        insertBeforeElement = afterElement;
        const insertIndex = Array.from(targetTimeline.children).indexOf(afterElement);
        
        let prevJob = null;
        for (let i = insertIndex - 1; i >= 0; i--) {
            const child = targetTimeline.children[i];
            if (child.classList.contains('job') && !child.classList.contains('job-dragging')) {
                prevJob = child;
                break;
            }
        }
        
        if (prevJob && prevJob.classList.contains('job') && !prevJob.classList.contains('job-printed')) {
            const prevJobId = prevJob.getAttribute('data-job-id');
            newStartTime = jobSchedule[prevJobId]?.endTime || new Date().getTime();
        } else {
            const printedJobs = targetTimeline.querySelectorAll('.job.job-printed');
            if (printedJobs.length > 0) {
                const lastPrinted = printedJobs[printedJobs.length - 1];
                const lastPrintedId = lastPrinted.getAttribute('data-job-id');
                newStartTime = jobSchedule[lastPrintedId]?.endTime || new Date().getTime();
            } else {
                newStartTime = new Date().getTime();
            }
        }
        
        targetTimeline.insertBefore(draggedElement, afterElement);
    } else {
        const firstPrinted = targetTimeline.querySelector('.job.job-printed');
        if (firstPrinted) {
            targetTimeline.insertBefore(draggedElement, firstPrinted);
        } else {
            targetTimeline.appendChild(draggedElement);
        }
        
        const lastActive = targetTimeline.querySelectorAll('.job:not(.job-printed)');
        if (lastActive.length > 0) {
            const lastJob = lastActive[lastActive.length - 1];
            const lastJobId = lastJob.getAttribute('data-job-id');
            newStartTime = jobSchedule[lastJobId]?.endTime || new Date().getTime();
        } else {
            const printedJobs = targetTimeline.querySelectorAll('.job.job-printed');
            if (printedJobs.length > 0) {
                const lastPrinted = printedJobs[printedJobs.length - 1];
                const lastPrintedId = lastPrinted.getAttribute('data-job-id');
                newStartTime = jobSchedule[lastPrintedId]?.endTime || new Date().getTime();
            } else {
                newStartTime = new Date().getTime();
            }
        }
    }
    
    if (jobSchedule[jobId]) {
        const duration = (jobSchedule[jobId].endTime - jobSchedule[jobId].startTime);
        jobSchedule[jobId] = {
            startTime: newStartTime,
            endTime: newStartTime + duration,
            timelineId: targetTimeline.id,
            isPrinted: false
        };
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
// EXPOSE TO WINDOW
// ============================================================
window.initializeApp = initializeApp;
window.setupEventListeners = setupEventListeners;
window.setupDragAndDrop = setupDragAndDrop;
window.handleFeedToTimeline = handleFeedToTimeline;
window.handleJobReorder = handleJobReorder;
window.checkJobOnTimeline = checkJobOnTimeline;
window.getDragAfterElement = getDragAfterElement;
window.initializeTimelineRulers = initializeTimelineRulers;
window.setupAutoSaveTriggers = setupAutoSaveTriggers;
window.rebuildTimelinesFromSchedules = rebuildTimelinesFromSchedules;

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
console.log('  - refreshAllTimelines()  : Regenerate all timeline rulers');
console.log('  - exportPLData()         : Export PL data to Excel');
console.log('  - rebuildTimelinesFromSchedules() : Rebuild timelines from saved schedules');
console.log('Keyboard shortcuts:');
console.log('  - Ctrl + +/-            : Zoom in/out');
console.log('  - Ctrl + 0              : Reset zoom');
console.log('  - Delete                : Remove selected job');
console.log('Upload buttons:');
console.log('  - Upload AW: Updates job statuses from AW file');
console.log('  - Upload PL: Updates/creates jobs from PL file');
console.log('  - Export PL: Downloads current data');
console.log('%c===================================', 'font-size:16px;font-weight:bold;color:#3498db;');
