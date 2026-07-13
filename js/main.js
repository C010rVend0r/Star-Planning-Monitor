// script-main.js
// ============================================================
// MAIN APPLICATION INITIALIZATION
// ============================================================

document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded - initializing app');
    initializeApp();
});

function initializeApp() {
    console.log('Initializing application...');
    
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
    
    console.log('Application initialized successfully');
}

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
    
    setupDragAndDrop();
    setupExcelUploads();
    
    document.addEventListener('click', function(e) {
        const feedJob = e.target.closest('.feed-job');
        if (feedJob) {
            if (e.target.closest('input') || e.target.closest('button') || 
                e.target.closest('.feed-status') || e.target.closest('.feed-pl-status')) {
                return;
            }
            const jobId = feedJob.getAttribute('data-job-id');
            if (jobId) {
                e.stopPropagation();
                console.log('Feed job clicked:', jobId);
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
                console.log('Timeline job clicked:', jobId);
                openJobDetailsModal(jobId);
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
    
    // Track auto-scroll during drag
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
    
    // Add drag over listeners to all timeline containers
    document.querySelectorAll('.timeline-container').forEach(container => {
        container.addEventListener('dragover', function(e) {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            
            // Auto-scroll logic
            const rect = this.getBoundingClientRect();
            const mouseX = e.clientX;
            
            // Stop any existing scroll
            if (dragScrollInterval) {
                clearInterval(dragScrollInterval);
                dragScrollInterval = null;
            }
            
            // Check if mouse is near edges
            if (mouseX < rect.left + SCROLL_MARGIN) {
                // Scroll left
                dragScrollInterval = setInterval(() => {
                    this.scrollLeft -= SCROLL_SPEED;
                }, 16);
            } else if (mouseX > rect.right - SCROLL_MARGIN) {
                // Scroll right
                dragScrollInterval = setInterval(() => {
                    this.scrollLeft += SCROLL_SPEED;
                }, 16);
            }
            
            // Store current container for cleanup
            currentDragContainer = this;
        });
        
        container.addEventListener('dragleave', function(e) {
            // Only stop scrolling if we're actually leaving the container
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
            
            // Stop auto-scroll
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
                
                // Sort printed jobs to the left
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
    
    // Get the machine number from the timeline ID
    const machineNumber = timeline.id.replace('timeline-', '');
    
    // Update machine field in job data
    if (jobDatabase[jobId]) {
        jobDatabase[jobId].machine = machineNumber;
    }
    if (plDatabase[jobId]) {
        plDatabase[jobId].machine = machineNumber;
    }
    
    // Get all active jobs (non-printed)
    const activeJobs = timeline.querySelectorAll('.job:not(.job-printed)');
    let newStartTime;
    let insertBeforeElement = null;
    
    if (activeJobs.length > 0) {
        // Find where to insert based on mouse position
        const afterElement = getDragAfterElement(timeline, e.clientX);
        
        if (afterElement) {
            // Insert before the afterElement
            insertBeforeElement = afterElement;
            const insertIndex = Array.from(timeline.children).indexOf(afterElement);
            
            // Find the previous job (could be printed or active)
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
                // Insert at beginning - use current time or after last printed
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
            // Insert at the end
            const lastJob = activeJobs[activeJobs.length - 1];
            const lastJobId = lastJob.getAttribute('data-job-id');
            newStartTime = jobSchedule[lastJobId]?.endTime || new Date().getTime();
        }
    } else {
        // No active jobs - check printed jobs
        const printedJobs = timeline.querySelectorAll('.job.job-printed');
        if (printedJobs.length > 0) {
            const lastPrinted = printedJobs[printedJobs.length - 1];
            const lastPrintedId = lastPrinted.getAttribute('data-job-id');
            newStartTime = jobSchedule[lastPrintedId]?.endTime || new Date().getTime();
        } else {
            newStartTime = new Date().getTime();
        }
    }
    
    // Add job to timeline at the exact position
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
    
    // Remove from old position
    draggedElement.remove();
    
    // Get the machine number
    const machineNumber = targetTimeline.id.replace('timeline-', '');
    
    // Update machine field
    if (jobDatabase[jobId]) {
        jobDatabase[jobId].machine = machineNumber;
    }
    if (plDatabase[jobId]) {
        plDatabase[jobId].machine = machineNumber;
    }
    
    // Find insertion position
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
        // Insert at end before printed jobs
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
    
    // Update schedule with new start time
    if (jobSchedule[jobId]) {
        const duration = (jobSchedule[jobId].endTime - jobSchedule[jobId].startTime);
        jobSchedule[jobId] = {
            startTime: newStartTime,
            endTime: newStartTime + duration,
            timelineId: targetTimeline.id,
            isPrinted: false
        };
    }
    
    // Reschedule both timelines
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
console.log('Keyboard shortcuts:');
console.log('  - Ctrl + +/-            : Zoom in/out');
console.log('  - Ctrl + 0              : Reset zoom');
console.log('  - Delete                : Remove selected job');
console.log('Upload buttons:');
console.log('  - Upload AW: Updates job statuses from AW file');
console.log('  - Upload PL: Updates/creates jobs from PL file');
console.log('  - Export PL: Downloads current data');
console.log('%c===================================', 'font-size:16px;font-weight:bold;color:#3498db;');