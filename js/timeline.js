// timeline.js - COMPLETE WORKING VERSION
// ============================================================
// TIMELINE & MACHINE FUNCTIONS
// ============================================================

// ============================================================
// CONFIGURATION
// ============================================================
const machineConfig = {
    speed: 200,
    defaultSetup: 120
};

const machineIds = ['207', '208', '209', '210', '211'];

const jobColors = {
    current: '#f97319',
    next: '#2aced4',
    second: '#2aced4',
    future: '#2aced4',
    printed: '#95a5a6'
};

// ============================================================
// GLOBAL VARIABLES
// ============================================================
let jobSchedule = {};
let jobSpeeds = {};
let currentZoomLevel = 1.0;
const MIN_ZOOM = 0.3;
const MAX_ZOOM = 2.5;
const ZOOM_STEP = 0.1;
let autoScrollEnabled = true;
let timelineScrollInterval = null;
let nowIndicatorInterval = null;
let selectedJob = null;
let dragOverElement = null;
let draggedElement = null;
const nowIndicatorPositions = {};
const timelineStateCache = {};
let isGeneratingRuler = false;
let scaleTimeout = null;
let pendingTimelineIds = new Set();
let isUpdatingCompletedJobs = false;

// ============================================================
// REPAINT FUNCTION - THE FIX FOR SUBSEQUENT DRAGS
// ============================================================
function forceCompleteRepaint(timelineId) {
    const timeline = document.getElementById(timelineId);
    if (!timeline) return;
    
    const container = timeline.closest('.timeline-container');
    if (!container) return;
    
    // Clear cache
    delete timelineStateCache[timelineId];
    
    // Remove rulers
    container.querySelectorAll('.timeline-ruler, .timeline-date-header').forEach(el => el.remove());
    
    // ============================================================
    // ⭐ CRITICAL: Force complete DOM rebuild
    // ============================================================
    
    // Store all jobs
    const jobs = Array.from(timeline.querySelectorAll('.job'));
    if (jobs.length === 0) return;
    
    // Store job data
    const jobDataList = jobs.map(job => {
        const jobId = job.getAttribute('data-job-id');
        const isPrinted = job.classList.contains('job-printed');
        return { jobId, isPrinted, element: job };
    });
    
    // Clear timeline
    while (timeline.firstChild) {
        timeline.removeChild(timeline.firstChild);
    }
    
    // Recreate all jobs from data
    jobDataList.forEach(({ jobId, isPrinted }) => {
        const jobData = jobDatabase[jobId];
        if (!jobData) return;
        
        const newJob = createJobElement(jobId, jobData);
        if (isPrinted) {
            newJob.classList.add('job-printed');
            newJob.setAttribute('draggable', 'false');
        }
        timeline.appendChild(newJob);
    });
    
    // Force multiple reflows
    container.style.display = 'none';
    void container.offsetHeight;
    container.style.display = '';
    
    // Scale and regenerate
    scaleTimeline(timelineId);
    generateTimelineRuler(timeline);
    updateNowIndicatorPosition(timeline);
    updateAllJobColors();
    updateAllJobTimes();
    
    // Second pass
    setTimeout(() => {
        scaleTimeline(timelineId);
        generateTimelineRuler(timeline);
        updateNowIndicatorPosition(timeline);
        updateAllJobColors();
        updateAllJobTimes();
        updateAllTimelineScrollPositions();
    }, 50);
}

// ============================================================
// IMMEDIATE SCHEDULE SAVE
// ============================================================
async function saveSchedulesImmediately() {
    try {
        const schedulesToSave = {};
        for (const [jobId, data] of Object.entries(jobSchedule)) {
            if (!data.startTime || !data.endTime) continue;
            schedulesToSave[jobId] = {
                start_time: new Date(data.startTime).toISOString(),
                end_time: new Date(data.endTime).toISOString(),
                timeline_id: data.timelineId || '',
                is_printed: data.isPrinted || false
            };
        }
        if (Object.keys(schedulesToSave).length === 0) return;
        if (typeof supabaseSaveMultipleSchedules === 'function') {
            await supabaseSaveMultipleSchedules(schedulesToSave);
        }
    } catch (error) {
        console.error('❌ Immediate schedule save error:', error);
    }
}

// ============================================================
// TIMELINE RULER GENERATION
// ============================================================
function generateTimelineRuler(timeline) {
    if (isGeneratingRuler) return;
    isGeneratingRuler = true;
    
    try {
        const container = timeline.closest('.timeline-container');
        if (!container) { isGeneratingRuler = false; return; }
        
        container.querySelectorAll('.timeline-ruler, .timeline-date-header').forEach(el => el.remove());
        
        const jobs = timeline.querySelectorAll('.job');
        if (jobs.length === 0) { isGeneratingRuler = false; return; }
        
        let totalWidth = 0;
        jobs.forEach(job => { totalWidth += job.offsetWidth + 6; });
        totalWidth += 24;
        totalWidth = Math.max(totalWidth, timeline.offsetWidth, 800);
        
        const containerRect = container.getBoundingClientRect();
        const scrollLeft = container.scrollLeft || 0;
        
        let jobPositions = [];
        jobs.forEach(job => {
            const jobId = job.getAttribute('data-job-id');
            const scheduleData = jobSchedule[jobId];
            if (scheduleData) {
                const jobRect = job.getBoundingClientRect();
                jobPositions.push({
                    id: jobId,
                    startTime: scheduleData.startTime,
                    endTime: scheduleData.endTime,
                    leftPx: jobRect.left - containerRect.left + scrollLeft,
                    rightPx: jobRect.right - containerRect.left + scrollLeft,
                    isPrinted: job.classList.contains('job-printed')
                });
            }
        });
        
        if (jobPositions.length === 0) { isGeneratingRuler = false; return; }
        
        const dateHeader = document.createElement('div');
        dateHeader.className = 'timeline-date-header';
        const startDate = new Date(jobPositions[0].startTime);
        const endDate = new Date(jobPositions[jobPositions.length - 1].endTime);
        const today = new Date();
        dateHeader.innerHTML = `
            <span class="date-range">
                ${startDate.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })} 
                → ${endDate.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
            </span>
            <span class="today-date">Today: ${today.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}</span>
        `;
        
        const ruler = document.createElement('div');
        ruler.className = 'timeline-ruler';
        ruler.style.width = totalWidth + 'px';
        
        jobPositions.forEach((pos, index) => {
            const startPercent = (pos.leftPx / totalWidth) * 100;
            const endPercent = (pos.rightPx / totalWidth) * 100;
            
            const startDateObj = new Date(pos.startTime);
            const endDateObj = new Date(pos.endTime);
            const startTimeStr = startDateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            const endTimeStr = endDateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            
            const startTick = document.createElement('div');
            startTick.className = 'ruler-tick start-tick';
            startTick.style.left = Math.max(0, Math.min(100, startPercent)) + '%';
            startTick.innerHTML = `<span class="tick-time start-time">▶ ${startTimeStr}</span>`;
            ruler.appendChild(startTick);
            
            const endTick = document.createElement('div');
            endTick.className = 'ruler-tick end-tick';
            endTick.style.left = Math.max(0, Math.min(100, endPercent)) + '%';
            endTick.innerHTML = `<span class="tick-time end-time">■ ${endTimeStr}</span>`;
            ruler.appendChild(endTick);
            
            if (index < jobPositions.length - 1) {
                const nextPos = jobPositions[index + 1];
                const boundaryPos = (pos.rightPx + nextPos.leftPx) / 2;
                const boundaryPercent = (boundaryPos / totalWidth) * 100;
                const boundaryLine = document.createElement('div');
                boundaryLine.className = 'ruler-boundary-line';
                boundaryLine.style.left = Math.max(0, Math.min(100, boundaryPercent)) + '%';
                ruler.appendChild(boundaryLine);
            }
        });
        
        container.prepend(ruler);
        container.prepend(dateHeader);
        updateNowIndicatorPosition(timeline);
        
    } catch (error) {
        console.error('Error generating ruler:', error);
    } finally {
        isGeneratingRuler = false;
    }
}

// ============================================================
// NOW INDICATOR
// ============================================================
function updateNowIndicatorPosition(timeline) {
    const now = new Date();
    const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const nowTime = now.getTime();
    
    const container = timeline.closest('.timeline-container');
    if (!container) return;
    
    let ruler = container.querySelector('.timeline-ruler');
    if (!ruler) {
        generateTimelineRuler(timeline);
        ruler = container.querySelector('.timeline-ruler');
        if (!ruler) return;
    }
    
    const jobs = timeline.querySelectorAll('.job:not(.job-printed)');
    let marker = ruler.querySelector('.ruler-now-marker');
    if (!marker) {
        marker = document.createElement('div');
        marker.className = 'ruler-now-marker';
        ruler.appendChild(marker);
    }
    
    if (jobs.length === 0) {
        marker.style.display = 'none';
        delete nowIndicatorPositions[timeline.id];
        return;
    }
    
    marker.style.display = 'block';
    
    const containerRect = container.getBoundingClientRect();
    const scrollLeft = container.scrollLeft || 0;
    const totalWidth = Math.max(ruler.scrollWidth, timeline.scrollWidth, container.scrollWidth, 800);
    
    let positionPercentage = 2;
    let progressPercent = 0;
    let foundPosition = false;
    
    for (let i = 0; i < jobs.length; i++) {
        const job = jobs[i];
        const jobId = job.getAttribute('data-job-id');
        const schedule = jobSchedule[jobId];
        if (!schedule) continue;
        
        if (nowTime >= schedule.startTime && nowTime <= schedule.endTime) {
            const jobRect = job.getBoundingClientRect();
            const jobLeft = jobRect.left - containerRect.left + scrollLeft;
            const jobWidth = jobRect.width;
            const jobDuration = schedule.endTime - schedule.startTime;
            const elapsed = nowTime - schedule.startTime;
            const progress = jobDuration > 0 ? elapsed / jobDuration : 0;
            const posPx = jobLeft + (progress * jobWidth);
            positionPercentage = (posPx / totalWidth) * 100;
            progressPercent = Math.round(progress * 100);
            foundPosition = true;
            break;
        }
    }
    
    if (!foundPosition && jobs.length > 0) {
        const firstJob = jobs[0];
        const lastJob = jobs[jobs.length - 1];
        const firstId = firstJob.getAttribute('data-job-id');
        const lastId = lastJob.getAttribute('data-job-id');
        if (jobSchedule[firstId] && jobSchedule[lastId]) {
            const firstStart = jobSchedule[firstId].startTime;
            const lastEnd = jobSchedule[lastId].endTime;
            const firstRect = firstJob.getBoundingClientRect();
            const lastRect = lastJob.getBoundingClientRect();
            const firstLeftPx = firstRect.left - containerRect.left + scrollLeft;
            const lastRightPx = lastRect.right - containerRect.left + scrollLeft;
            
            if (nowTime < firstStart) {
                positionPercentage = Math.max(0.5, (firstLeftPx / totalWidth) * 100);
                progressPercent = 0;
            } else if (nowTime > lastEnd) {
                positionPercentage = Math.min(99.5, (lastRightPx / totalWidth) * 100);
                progressPercent = 100;
            } else {
                const totalDuration = lastEnd - firstStart;
                let progress = (nowTime - firstStart) / totalDuration;
                progress = Math.max(0, Math.min(1, progress));
                const posPx = firstLeftPx + (progress * (lastRightPx - firstLeftPx));
                positionPercentage = (posPx / totalWidth) * 100;
                progressPercent = Math.round(progress * 100);
            }
        }
    }
    
    positionPercentage = Math.max(0.5, Math.min(99.5, positionPercentage));
    progressPercent = Math.max(0, Math.min(100, progressPercent));
    
    nowIndicatorPositions[timeline.id] = {
        position: positionPercentage,
        time: timeString,
        progress: progressPercent,
        timestamp: now.getTime()
    };
    
    marker.style.left = positionPercentage + '%';
    marker.style.transition = 'left 0.5s ease';
    
    let label = marker.querySelector('.ruler-now-label');
    if (!label) {
        label = document.createElement('span');
        label.className = 'ruler-now-label';
        marker.appendChild(label);
    }
    label.textContent = `🔴 NOW ${timeString}  (${progressPercent}%)`;
}

function updateAllNowIndicators() {
    document.querySelectorAll('.timeline').forEach(timeline => {
        updateNowIndicatorPosition(timeline);
    });
}

function initializeNowIndicators() {
    if (nowIndicatorInterval) clearInterval(nowIndicatorInterval);
    setTimeout(updateAllNowIndicators, 500);
    nowIndicatorInterval = setInterval(updateAllNowIndicators, 5000);
}

function setupNowIndicatorPersistence() {
    if (nowIndicatorInterval) clearInterval(nowIndicatorInterval);
    nowIndicatorInterval = setInterval(updateAllNowIndicators, 5000);
}

function setupResizeObserver() {
    if (window.ResizeObserver) {
        const resizeObserver = new ResizeObserver(updateAllNowIndicators);
        document.querySelectorAll('.timeline-container').forEach(container => {
            resizeObserver.observe(container);
        });
        return resizeObserver;
    }
    return null;
}

// ============================================================
// SCALE TIMELINE
// ============================================================
function scaleTimeline(timelineId) {
    const timeline = document.getElementById(timelineId);
    if (!timeline) return;
    
    const jobs = timeline.querySelectorAll('.job');
    if (jobs.length === 0) {
        const container = timeline.closest('.timeline-container');
        if (container) {
            container.querySelectorAll('.timeline-ruler, .timeline-date-header').forEach(el => el.remove());
        }
        delete timelineStateCache[timelineId];
        return;
    }
    
    const printedJobs = [];
    const activeJobs = [];
    jobs.forEach(job => {
        if (job.classList.contains('job-printed')) printedJobs.push(job);
        else activeJobs.push(job);
    });
    
    if (activeJobs.length === 0) {
        printedJobs.forEach(job => {
            let width = 120 * currentZoomLevel;
            width = Math.max(80, Math.min(250, width));
            applyJobStyle(job, width);
        });
        delete timelineStateCache[timelineId];
        return;
    }
    
    const jobDurations = [];
    let totalDuration = 0;
    activeJobs.forEach(job => {
        const jobId = job.getAttribute('data-job-id');
        const duration = calculateJobDuration(jobDatabase[jobId], jobId);
        jobDurations.push({ job, duration, jobId });
        totalDuration += duration;
    });
    
    const MIN_JOB_WIDTH = 80;
    const MAX_JOB_WIDTH = 500;
    const CONTAINER_PADDING = 60;
    const container = timeline.closest('.timeline-container');
    const containerWidth = container ? container.clientWidth : 1200;
    
    let pixelsPerMinute;
    if (totalDuration > 0) {
        const availableWidth = Math.max(containerWidth - CONTAINER_PADDING, 400);
        const baseWidth = Math.max(availableWidth, activeJobs.length * MIN_JOB_WIDTH);
        pixelsPerMinute = (baseWidth / totalDuration) * currentZoomLevel;
        pixelsPerMinute = Math.max(0.8, Math.min(20, pixelsPerMinute));
    } else {
        pixelsPerMinute = 2 * currentZoomLevel;
    }
    
    jobDurations.forEach(({ job, duration }) => {
        let width = duration * pixelsPerMinute;
        width = Math.max(MIN_JOB_WIDTH, Math.min(MAX_JOB_WIDTH, width));
        applyJobStyle(job, width);
    });
    
    printedJobs.forEach(job => {
        let width = 120 * currentZoomLevel;
        width = Math.max(80, Math.min(250, width));
        applyJobStyle(job, width);
    });
    
    if (container) {
        container.querySelectorAll('.timeline-ruler, .timeline-date-header').forEach(el => el.remove());
        delete timelineStateCache[timelineId];
        generateTimelineRuler(timeline);
    }
}

function debouncedScaleTimeline(timelineId, delay = 300) {
    if (!timelineId) return;
    pendingTimelineIds.add(timelineId);
    if (scaleTimeout) clearTimeout(scaleTimeout);
    scaleTimeout = setTimeout(() => {
        const ids = Array.from(pendingTimelineIds);
        pendingTimelineIds.clear();
        ids.forEach(id => {
            try {
                delete timelineStateCache[id];
                const timeline = document.getElementById(id);
                if (timeline) {
                    const container = timeline.closest('.timeline-container');
                    if (container) {
                        container.querySelectorAll('.timeline-ruler, .timeline-date-header').forEach(el => el.remove());
                    }
                }
                scaleTimeline(id);
            } catch (e) {
                console.warn('Error scaling timeline:', id, e);
            }
        });
        scaleTimeout = null;
    }, delay);
}

function applyJobStyle(job, jobWidth) {
    jobWidth = Math.round(jobWidth * 10) / 10;
    const minWidth = 80;
    const maxWidth = 500;
    jobWidth = Math.max(minWidth, Math.min(maxWidth, jobWidth));
    
    job.style.setProperty('width', jobWidth + 'px', 'important');
    job.style.setProperty('flex-shrink', '0', 'important');
    job.style.setProperty('min-width', minWidth + 'px', 'important');
    job.style.setProperty('max-width', maxWidth + 'px', 'important');
    
    const fontSize = Math.max(9, Math.min(14, 11 * (jobWidth / 200)));
    const nameFontSize = Math.max(9, Math.min(13, 10 * (jobWidth / 200)));
    const badgeFontSize = Math.max(11, Math.min(16, 13 * (jobWidth / 200)));
    
    const jobName = job.querySelector('.job-name');
    if (jobName) {
        jobName.style.fontSize = nameFontSize + 'px';
        const badge = jobName.querySelector('.job-number-badge');
        if (badge) {
            badge.style.fontSize = badgeFontSize + 'px';
            badge.style.fontWeight = '700';
        }
    }
    const jobDetails = job.querySelector('.job-details');
    if (jobDetails) jobDetails.style.fontSize = (fontSize * 0.85) + 'px';
    const jobDurationEl = job.querySelector('.job-duration');
    if (jobDurationEl) jobDurationEl.style.fontSize = (fontSize * 1.1) + 'px';
    const jobBreakdown = job.querySelector('.job-breakdown');
    if (jobBreakdown) jobBreakdown.style.fontSize = (fontSize * 0.75) + 'px';
    const jobTime = job.querySelector('.job-time');
    if (jobTime) jobTime.style.fontSize = (fontSize * 0.75) + 'px';
    const padding = Math.max(4, Math.min(12, 8 * (jobWidth / 200)));
    job.style.padding = padding + 'px ' + (padding * 1.2) + 'px';
}

// ============================================================
// CALCULATE JOB DURATION
// ============================================================
function calculateJobDuration(jobData, jobId = null) {
    let speed = machineConfig.speed;
    if (jobId && jobSpeeds[jobId]) speed = jobSpeeds[jobId];
    const printingTime = jobData.quantity / speed;
    return Math.round((jobData.setup + printingTime) * 100) / 100;
}

// ============================================================
// RESCHEDULE TIMELINE
// ============================================================
function rescheduleTimelineJobs(timelineId, preserveExisting = true) {
    const timeline = document.getElementById(timelineId);
    if (!timeline) return;
    if (timeline._rescheduling) return;
    timeline._rescheduling = true;
    
    try {
        const activeJobsArray = Array.from(timeline.querySelectorAll('.job:not(.job-printed)'));
        const printedJobs = timeline.querySelectorAll('.job.job-printed');
        if (activeJobsArray.length === 0) { timeline._rescheduling = false; return; }
        
        let baseStartTime = null;
        if (printedJobs.length > 0) {
            const lastPrinted = printedJobs[printedJobs.length - 1];
            const lastPrintedId = lastPrinted.getAttribute('data-job-id');
            if (jobSchedule[lastPrintedId]) {
                baseStartTime = jobSchedule[lastPrintedId].endTime;
            }
        }
        if (baseStartTime === null && activeJobsArray.length > 0) {
            const firstJob = activeJobsArray[0];
            const firstId = firstJob.getAttribute('data-job-id');
            if (jobSchedule[firstId]) {
                baseStartTime = jobSchedule[firstId].startTime;
            }
        }
        if (baseStartTime === null) baseStartTime = new Date().getTime();
        
        let currentTime = baseStartTime;
        for (let i = 0; i < activeJobsArray.length; i++) {
            const job = activeJobsArray[i];
            const jobId = job.getAttribute('data-job-id');
            const jobData = jobDatabase[jobId];
            if (!jobData) continue;
            
            const duration = calculateJobDuration(jobData, jobId) * 60000;
            if (i === 0 && preserveExisting && jobSchedule[jobId] && jobSchedule[jobId].startTime !== undefined) {
                const existingStart = jobSchedule[jobId].startTime;
                if (Math.abs(existingStart - baseStartTime) < 3600000) {
                    currentTime = existingStart;
                } else {
                    currentTime = baseStartTime;
                }
            }
            jobSchedule[jobId] = {
                startTime: currentTime,
                endTime: currentTime + duration,
                timelineId: timelineId,
                isPrinted: false
            };
            currentTime = currentTime + duration;
        }
    } finally {
        timeline._rescheduling = false;
    }
    debouncedScaleTimeline(timelineId);
}

// ============================================================
// ADD JOB TO TIMELINE
// ============================================================
function addJobToTimelineWithSchedule(jobId, timelineId, startTime, insertBeforeElement) {
    const timeline = document.getElementById(timelineId);
    if (!timeline) return;
    const jobData = jobDatabase[jobId];
    if (!jobData) return;
    
    const jobElement = createJobElement(jobId, jobData);
    const machineNumber = timelineId.replace('timeline-', '');
    jobData.machine = machineNumber;
    if (plDatabase[jobId]) plDatabase[jobId].machine = machineNumber;
    
    const duration = calculateJobDuration(jobData, jobId);
    const endTime = startTime + duration * 60000;
    
    jobSchedule[jobId] = {
        startTime: startTime,
        endTime: endTime,
        timelineId: timelineId,
        isPrinted: false
    };
    
    let validInsertBefore = null;
    if (insertBeforeElement && insertBeforeElement.parentElement === timeline) {
        validInsertBefore = insertBeforeElement;
    } else if (insertBeforeElement) {
        const jobIdToInsertBefore = insertBeforeElement.getAttribute('data-job-id');
        if (jobIdToInsertBefore) {
            const foundElement = timeline.querySelector(`.job[data-job-id="${jobIdToInsertBefore}"]`);
            if (foundElement && foundElement.parentElement === timeline) {
                validInsertBefore = foundElement;
            }
        }
    }
    
    if (validInsertBefore) {
        timeline.insertBefore(jobElement, validInsertBefore);
    } else {
        const firstPrinted = timeline.querySelector('.job.job-printed');
        if (firstPrinted) timeline.insertBefore(jobElement, firstPrinted);
        else timeline.appendChild(jobElement);
    }
    
    const activeJobs = Array.from(timeline.querySelectorAll('.job:not(.job-printed)'));
    if (activeJobs.length > 1) {
        activeJobs.sort((a, b) => {
            const aId = a.getAttribute('data-job-id');
            const bId = b.getAttribute('data-job-id');
            const aPriority = jobDatabase[aId]?.priority !== undefined ? jobDatabase[aId].priority : 999;
            const bPriority = jobDatabase[bId]?.priority !== undefined ? jobDatabase[bId].priority : 999;
            return aPriority - bPriority;
        });
        const printed = Array.from(timeline.querySelectorAll('.job.job-printed'));
        while (timeline.firstChild) timeline.removeChild(timeline.firstChild);
        printed.forEach(job => timeline.appendChild(job));
        activeJobs.forEach(job => timeline.appendChild(job));
    }
    
    delete timelineStateCache[timelineId];
    const container = timeline.closest('.timeline-container');
    if (container) {
        container.querySelectorAll('.timeline-ruler, .timeline-date-header').forEach(el => el.remove());
    }
    debouncedScaleTimeline(timelineId);
    updateMachineStatus(timeline.closest('.machine'));
    updateJobTimeDisplay(jobId);
    updateAllJobColors();
    updateStatistics();
    applySmartZoom();
    setTimeout(updateAllTimelineScrollPositions, 300);
    saveSchedulesImmediately();
}

// ============================================================
// HANDLE FEED TO TIMELINE - WITH PRECISE DROP POSITION
// ============================================================
function handleFeedToTimeline(jobId, timeline, dropX = null) {
    const existingJobOnTimeline = document.querySelector(`.job[data-job-id="${jobId}"]`);
    if (existingJobOnTimeline) {
        showNotification(`⚠️ "${jobDatabase[jobId]?.name || jobId}" is already on the timeline!`, 'warning');
        return;
    }
    if (!jobDatabase[jobId]) {
        showNotification(`❌ Job "${jobId}" not found!`, 'error');
        return;
    }
    
    // Update job status to Planned
    updateJobPLStatus(jobId, 'Planned');
    const machineNumber = timeline.id.replace('timeline-', '');
    if (jobDatabase[jobId]) jobDatabase[jobId].machine = machineNumber;
    if (plDatabase[jobId]) plDatabase[jobId].machine = machineNumber;
    
    const jobData = jobDatabase[jobId];
    const newPriority = jobData?.priority !== undefined ? jobData.priority : 999;
    
    // ⭐ CRITICAL: Determine where to insert based on drop position
    let insertBeforeElement = null;
    let newStartTime;
    
    // Get the active jobs (non-printed)
    const activeJobs = Array.from(timeline.querySelectorAll('.job:not(.job-printed)'));
    
    if (activeJobs.length > 0) {
        // If we have a drop X position, use it to find where to insert
        if (dropX !== null) {
            // Get the element to insert before based on mouse position
            const container = timeline.closest('.timeline-container');
            if (container) {
                const containerRect = container.getBoundingClientRect();
                const scrollLeft = container.scrollLeft || 0;
                const relativeX = dropX - containerRect.left + scrollLeft;
                
                // Find which job the pointer is over
                let foundJob = null;
                for (const job of activeJobs) {
                    const jobRect = job.getBoundingClientRect();
                    const jobLeft = jobRect.left - containerRect.left + scrollLeft;
                    const jobRight = jobRect.right - containerRect.left + scrollLeft;
                    
                    if (relativeX >= jobLeft && relativeX <= jobRight) {
                        foundJob = job;
                        break;
                    }
                }
                
                if (foundJob) {
                    // Check if pointer is in the left or right half of the job
                    const jobRect = foundJob.getBoundingClientRect();
                    const jobCenter = jobRect.left + (jobRect.width / 2);
                    
                    if (dropX < jobCenter) {
                        // Insert before this job
                        insertBeforeElement = foundJob;
                    } else {
                        // Insert after this job
                        let nextSibling = foundJob.nextElementSibling;
                        while (nextSibling && nextSibling.classList.contains('job-printed')) {
                            nextSibling = nextSibling.nextElementSibling;
                        }
                        insertBeforeElement = nextSibling || null;
                    }
                } else {
                    // If not over any job, check if before the first or after the last
                    if (activeJobs.length > 0) {
                        const firstJob = activeJobs[0];
                        const lastJob = activeJobs[activeJobs.length - 1];
                        const firstRect = firstJob.getBoundingClientRect();
                        const lastRect = lastJob.getBoundingClientRect();
                        
                        if (dropX < firstRect.left) {
                            insertBeforeElement = firstJob;
                        } else if (dropX > lastRect.right) {
                            insertBeforeElement = null;
                        } else {
                            // Find the closest job by position
                            let closestJob = null;
                            let closestDist = Infinity;
                            for (const job of activeJobs) {
                                const rect = job.getBoundingClientRect();
                                const center = rect.left + rect.width / 2;
                                const dist = Math.abs(dropX - center);
                                if (dist < closestDist) {
                                    closestDist = dist;
                                    closestJob = job;
                                }
                            }
                            if (closestJob) {
                                const rect = closestJob.getBoundingClientRect();
                                const center = rect.left + rect.width / 2;
                                if (dropX < center) {
                                    insertBeforeElement = closestJob;
                                } else {
                                    let nextSibling = closestJob.nextElementSibling;
                                    while (nextSibling && nextSibling.classList.contains('job-printed')) {
                                        nextSibling = nextSibling.nextElementSibling;
                                    }
                                    insertBeforeElement = nextSibling || null;
                                }
                            }
                        }
                    }
                }
            }
        }
        
        // If no insert position found from dropX, use priority-based insertion
        if (insertBeforeElement === null && dropX === null) {
            // Priority-based insertion (original behavior)
            for (let i = 0; i < activeJobs.length; i++) {
                const existingJob = activeJobs[i];
                const existingId = existingJob.getAttribute('data-job-id');
                const existingPriority = jobDatabase[existingId]?.priority !== undefined ? jobDatabase[existingId].priority : 999;
                if (newPriority < existingPriority) {
                    insertBeforeElement = existingJob;
                    break;
                }
            }
        }
        
        // Calculate start time based on insertion position
        if (insertBeforeElement) {
            const insertIndex = Array.from(timeline.children).indexOf(insertBeforeElement);
            const prevJob = insertIndex > 0 ? timeline.children[insertIndex - 1] : null;
            if (prevJob && prevJob.classList.contains('job') && !prevJob.classList.contains('job-printed')) {
                const prevJobId = prevJob.getAttribute('data-job-id');
                newStartTime = jobSchedule[prevJobId]?.endTime || Date.now();
            } else {
                // Before first active job - use printed job end time or current time
                const printedJobs = timeline.querySelectorAll('.job.job-printed');
                if (printedJobs.length > 0) {
                    const lastPrinted = printedJobs[printedJobs.length - 1];
                    const lastPrintedId = lastPrinted.getAttribute('data-job-id');
                    newStartTime = jobSchedule[lastPrintedId]?.endTime || Date.now();
                } else {
                    newStartTime = Date.now();
                }
            }
        } else {
            // Insert at the end - after the last active job
            const lastJob = activeJobs[activeJobs.length - 1];
            const lastJobId = lastJob.getAttribute('data-job-id');
            newStartTime = jobSchedule[lastJobId]?.endTime || Date.now();
        }
    } else {
        // No active jobs - use printed job end time or current time
        const printedJobs = timeline.querySelectorAll('.job.job-printed');
        if (printedJobs.length > 0) {
            const lastPrinted = printedJobs[printedJobs.length - 1];
            const lastPrintedId = lastPrinted.getAttribute('data-job-id');
            newStartTime = jobSchedule[lastPrintedId]?.endTime || Date.now();
        } else {
            newStartTime = Date.now();
        }
    }
    
    // Add the job to the timeline at the calculated position
    addJobToTimelineWithSchedule(jobId, timeline.id, newStartTime, insertBeforeElement);
    rescheduleTimelineJobs(timeline.id, true);
    updateAllJobColors();
    updateStatistics();
    applySmartZoom();
    
    const jobName = jobDatabase[jobId]?.name || jobId;
    showNotification(`✅ "${jobName}" added to Machine ${machineNumber} (Priority: ${newPriority})`, 'success');
    setTimeout(updateAllTimelineScrollPositions, 300);
}

// ============================================================
// HANDLE JOB REORDER - WITH FORCE REPAINT
// ============================================================
function handleJobReorder(jobId, targetTimeline, insertBeforeElement) {
    const jobElement = draggedElement;
    const oldTimeline = jobElement.parentElement;
    const scheduleData = jobSchedule[jobId];
    if (!scheduleData) {
        console.warn(`⚠️ No schedule data for ${jobId}`);
        return;
    }
    
    const duration = scheduleData.endTime - scheduleData.startTime;
    jobElement.remove();
    
    const machineNumber = targetTimeline.id.replace('timeline-', '');
    if (jobDatabase[jobId]) jobDatabase[jobId].machine = machineNumber;
    if (plDatabase[jobId]) plDatabase[jobId].machine = machineNumber;
    
    if (insertBeforeElement && insertBeforeElement.parentElement === targetTimeline) {
        targetTimeline.insertBefore(jobElement, insertBeforeElement);
    } else {
        const firstPrinted = targetTimeline.querySelector('.job.job-printed');
        if (firstPrinted) targetTimeline.insertBefore(jobElement, firstPrinted);
        else targetTimeline.appendChild(jobElement);
    }
    
    const activeJobs = Array.from(targetTimeline.querySelectorAll('.job:not(.job-printed)'));
    const jobIndex = activeJobs.indexOf(jobElement);
    
    let newStartTime;
    if (jobIndex === 0) {
        const printedJobs = targetTimeline.querySelectorAll('.job.job-printed');
        if (printedJobs.length > 0) {
            const lastPrinted = printedJobs[printedJobs.length - 1];
            const lastPrintedId = lastPrinted.getAttribute('data-job-id');
            newStartTime = jobSchedule[lastPrintedId]?.endTime || Date.now();
        } else {
            newStartTime = Date.now();
        }
    } else {
        const prevJob = activeJobs[jobIndex - 1];
        if (prevJob) {
            const prevJobId = prevJob.getAttribute('data-job-id');
            newStartTime = jobSchedule[prevJobId]?.endTime || Date.now();
        } else {
            newStartTime = Date.now();
        }
    }
    
    jobSchedule[jobId] = {
        startTime: newStartTime,
        endTime: newStartTime + duration,
        timelineId: targetTimeline.id,
        isPrinted: false
    };
    
    // ⭐ CRITICAL: Force complete repaint on BOTH timelines
    forceCompleteRepaint(oldTimeline.id);
    if (oldTimeline.id !== targetTimeline.id) {
        forceCompleteRepaint(targetTimeline.id);
    }
    
    // Update all visual elements
    updateAllJobTimes();
    updateAllJobColors();
    updateStatistics();
    applySmartZoom();
    updateAllTimelineScrollPositions();
    
    saveSchedulesImmediately();
    console.log(`✅ Job ${jobId} reordered successfully`);
}

// ============================================================
// RETURN JOB TO FEED
// ============================================================
function returnJobToFeed(jobElement) {
    const jobId = jobElement.getAttribute('data-job-id');
    const jobData = jobDatabase[jobId];
    if (!jobData) return;
    if (jobElement.classList.contains('job-printed')) {
        showNotification(`⚠️ Cannot return completed job "${jobData.name || jobId}" to feed`, 'warning');
        return;
    }
    
    delete jobSpeeds[jobId];
    updateJobPLStatus(jobId, 'Unplanned');
    jobData.machine = '';
    jobData.isComplete = false;
    if (plDatabase[jobId]) {
        plDatabase[jobId].machine = '';
        plDatabase[jobId].isComplete = false;
    }
    
    const feedJob = createFeedJobElement(jobId, jobData);
    const productionFeedList = document.getElementById('production-feed-list');
    if (productionFeedList) {
        productionFeedList.appendChild(feedJob);
        const timeline = jobElement.parentElement;
        const timelineId = timeline.id;
        jobElement.remove();
        delete jobSchedule[jobId];
        
        forceCompleteRepaint(timelineId);
        
        rescheduleTimelineJobs(timelineId, true);
        debouncedScaleTimeline(timelineId);
        updateMachineStatus(timeline.closest('.machine'));
        applyFilter();
        updateStatistics();
        applySmartZoom();
        showNotification(`↩️ "${jobData.name || jobId}" returned to feed (PL: Unplanned)`, 'info');
        setTimeout(updateAllTimelineScrollPositions, 300);
        if (typeof supabaseDeleteSchedule === 'function') {
            supabaseDeleteSchedule(jobId);
        }
        saveSchedulesImmediately();
    }
}

// ============================================================
// DRAG AND DROP SETUP
// ============================================================
function setupDragAndDrop() {
    // Add this at the beginning of setupDragAndDrop function

    console.log('Setting up drag and drop with enhanced features...');
    let dragScrollInterval = null;
    const SCROLL_SPEED = 15;
    const SCROLL_MARGIN = 80;
    
    document.addEventListener('dragstart', function(e) {
        const target = e.target.closest('.feed-job, .job');
        if (target) {
            const jobId = target.getAttribute('data-job-id');
            if (target.classList.contains('feed-job')) {
                const isOnTimeline = !!document.querySelector(`.job[data-job-id="${jobId}"]`);
                if (isOnTimeline) {
                    target.classList.add('job-already-on-timeline');
                    target.setAttribute('title', `⚠️ "${jobDatabase[jobId]?.name || jobId}" is already on the timeline!`);
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
    
// In setupDragAndDrop function, update the dragend event
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
        // ⭐ Also remove feed job highlight
        document.querySelectorAll('.feed-job').forEach(job => {
            job.classList.remove('job-dragging');
        });
        draggedElement = null;
        updateStatistics();
    }
    if (dragScrollInterval) {
        clearInterval(dragScrollInterval);
        dragScrollInterval = null;
    }
});
    
    document.querySelectorAll('.timeline').forEach(timeline => {
        const container = timeline.closest('.timeline-container');
        if (!container) return;
        
        timeline.addEventListener('dragover', function(e) {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            const containerRect = container.getBoundingClientRect();
            const mouseX = e.clientX;
            
            if (mouseX < containerRect.left + SCROLL_MARGIN) {
                if (!dragScrollInterval) {
                    dragScrollInterval = setInterval(() => { container.scrollLeft -= SCROLL_SPEED; }, 16);
                }
            } else if (mouseX > containerRect.right - SCROLL_MARGIN) {
                if (!dragScrollInterval) {
                    dragScrollInterval = setInterval(() => { container.scrollLeft += SCROLL_SPEED; }, 16);
                }
            } else {
                if (dragScrollInterval) {
                    clearInterval(dragScrollInterval);
                    dragScrollInterval = null;
                }
            }
            // Inside timeline.addEventListener('dragover', function(e) { ... }
// Add this to handle feed job dragging visual feedback

if (draggedElement && draggedElement.classList.contains('feed-job')) {
    // Show that the feed job can be dropped here
    this.classList.add('drag-over');
    
    // Find the insertion point
    const insertBeforeElement = getDragAfterElement(this, e.clientX);
    if (insertBeforeElement) {
        this.querySelectorAll('.job').forEach(job => {
            job.classList.remove('drag-over-before', 'drag-over-after');
        });
        insertBeforeElement.classList.add('drag-over-before');
        dragOverElement = insertBeforeElement;
    } else {
        // If dropping at the end, highlight the last job or the timeline
        const jobs = this.querySelectorAll('.job:not(.job-printed)');
        if (jobs.length > 0) {
            const lastJob = jobs[jobs.length - 1];
            lastJob.classList.add('drag-over-after');
            dragOverElement = lastJob;
        }
    }
}
            if (draggedElement && draggedElement.classList.contains('job') && !draggedElement.classList.contains('job-printed')) {
                this.querySelectorAll('.job').forEach(job => {
                    job.classList.remove('drag-over-before', 'drag-over-after');
                });
                const insertBeforeElement = getDragAfterElement(this, e.clientX);
                if (insertBeforeElement) {
                    if (insertBeforeElement !== draggedElement) {
                        insertBeforeElement.classList.add('drag-over-before');
                        dragOverElement = insertBeforeElement;
                    } else {
                        dragOverElement = null;
                    }
                } else {
                    const jobs = this.querySelectorAll('.job:not(.job-dragging):not(.job-printed)');
                    if (jobs.length > 0) {
                        const lastJob = jobs[jobs.length - 1];
                        if (lastJob && lastJob !== draggedElement) {
                            lastJob.classList.add('drag-over-after');
                            dragOverElement = lastJob;
                        }
                    }
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
        
        // ⭐⭐⭐ DROP EVENT WITH COMPLETE REPAINT FIX
        timeline.addEventListener('drop', function(e) {
            e.preventDefault();
            
            if (dragScrollInterval) {
                clearInterval(dragScrollInterval);
                dragScrollInterval = null;
            }
            
            if (!draggedElement) {
                console.warn('⚠️ No dragged element');
                return;
            }
            
            const jobId = draggedElement.getAttribute('data-job-id');
            const isFeedJob = draggedElement.classList.contains('feed-job');
            const isTimelineJob = draggedElement.classList.contains('job') && !draggedElement.classList.contains('job-printed');
            
            console.log(`📊 Drop event: jobId=${jobId}, isFeedJob=${isFeedJob}, isTimelineJob=${isTimelineJob}`);
            
// In setupDragAndDrop function, inside the timeline 'drop' event handler
// Replace the isFeedJob section with this:

if (isFeedJob) {
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
    console.log(`📊 Dragging feed job ${jobId} to timeline`);
    
    // ⭐ CRITICAL: Pass the mouse X position for precise drop positioning
    const dropX = e.clientX;
    handleFeedToTimeline(jobId, this, dropX);
}
 else if (isTimelineJob) {
                console.log(`📊 Reordering timeline job ${jobId}`);
                
                let insertBeforeElement = null;
                
                if (dragOverElement) {
                    if (dragOverElement === draggedElement) {
                        console.log(`📊 Job ${jobId} dropped on itself, skipping`);
                        this.querySelectorAll('.job').forEach(job => {
                            job.classList.remove('drag-over-before', 'drag-over-after');
                        });
                        dragOverElement = null;
                        return;
                    }
                    
                    if (dragOverElement.classList.contains('drag-over-before')) {
                        insertBeforeElement = dragOverElement;
                    } else if (dragOverElement.classList.contains('drag-over-after')) {
                        let nextSibling = dragOverElement.nextElementSibling;
                        while (nextSibling && (nextSibling.classList.contains('job-printed') || nextSibling === draggedElement)) {
                            nextSibling = nextSibling.nextElementSibling;
                        }
                        if (nextSibling) {
                            insertBeforeElement = nextSibling;
                        }
                    }
                }
                
                const currentJobs = Array.from(this.querySelectorAll('.job:not(.job-printed)'));
                const currentPosition = currentJobs.indexOf(draggedElement);
                let targetPosition = insertBeforeElement ? currentJobs.indexOf(insertBeforeElement) : currentJobs.length;
                
                if (currentPosition === targetPosition) {
                    console.log(`📊 Job ${jobId} position unchanged, skipping`);
                    this.querySelectorAll('.job').forEach(job => {
                        job.classList.remove('drag-over-before', 'drag-over-after');
                    });
                    dragOverElement = null;
                    return;
                }
                
                console.log(`📊 Reordering job ${jobId}: from ${currentPosition} to ${targetPosition}`);
                handleJobReorder(jobId, this, insertBeforeElement);
            }
            
            // Clean up
            this.querySelectorAll('.job').forEach(job => {
                job.classList.remove('drag-over-before', 'drag-over-after');
            });
            dragOverElement = null;
            
            sortPrintedJobs(this);
            sortTimelineJobsByPriority(this);
            
            // ⭐⭐⭐ CRITICAL: Force complete repaint after EVERY drop
            const timelineId = this.id;
            
            // First repaint pass
            setTimeout(() => {
                forceCompleteRepaint(timelineId);
            }, 50);
            
            // Second repaint pass after everything settles
            setTimeout(() => {
                forceCompleteRepaint(timelineId);
                updateAllTimelineScrollPositions();
            }, 200);
            
            // Update all visual elements
            updateAllJobColors();
            updateStatistics();
            applySmartZoom();
            setTimeout(updateAllTimelineScrollPositions, 300);
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
                setTimeout(updateAllTimelineScrollPositions, 300);
            }
        });
    }
}

function getDragAfterElement(container, x) {
    const draggableElements = [...container.querySelectorAll('.job:not(.job-dragging):not(.job-printed)')];
    if (draggableElements.length === 0) return null;
    let closestElement = null;
    let closestDistance = Infinity;
    for (const child of draggableElements) {
        const box = child.getBoundingClientRect();
        const childCenter = box.left + box.width / 2;
        const distance = Math.abs(x - childCenter);
        if (distance < closestDistance) {
            closestDistance = distance;
            closestElement = child;
        }
    }
    if (!closestElement) return null;
    const box = closestElement.getBoundingClientRect();
    const childCenter = box.left + box.width / 2;
    if (x < childCenter) return closestElement;
    let nextSibling = closestElement.nextElementSibling;
    while (nextSibling && (nextSibling.classList.contains('job-printed') || nextSibling.classList.contains('job-dragging'))) {
        nextSibling = nextSibling.nextElementSibling;
    }
    return nextSibling || null;
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
    document.querySelectorAll('.machine').forEach(machine => updateMachineStatus(machine));
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
    document.querySelectorAll('.timeline').forEach(timeline => updateJobColors(timeline.id));
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
    jobElement.dataset.startTime = schedule.startTime;
    jobElement.dataset.endTime = schedule.endTime;
}

function updateAllJobTimes() {
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
    }
}

// ============================================================
// TIMELINE SCROLLING
// ============================================================
function startTimelineScrolling() {
    if (timelineScrollInterval) clearInterval(timelineScrollInterval);
    timelineScrollInterval = setInterval(updateAllTimelineScrollPositions, 5000);
    setTimeout(updateAllTimelineScrollPositions, 1000);
}

function updateAllTimelineScrollPositions() {
    document.querySelectorAll('.timeline').forEach(timeline => updateTimelineScrollPosition(timeline));
}

function updateTimelineScrollPosition(timeline) {
    const container = timeline.closest('.timeline-container');
    if (!container || !autoScrollEnabled) return;
    const now = new Date().getTime();
    const jobs = timeline.querySelectorAll('.job:not(.job-printed)');
    if (jobs.length === 0) { container.scrollLeft = 0; return; }
    
    const firstJob = jobs[0];
    const firstJobId = firstJob.getAttribute('data-job-id');
    if (!jobSchedule[firstJobId]) return;
    const firstStartTime = jobSchedule[firstJobId].startTime;
    const lastJob = jobs[jobs.length - 1];
    const lastJobId = lastJob.getAttribute('data-job-id');
    const lastEndTime = jobSchedule[lastJobId]?.endTime || firstStartTime + 3600000;
    const totalDuration = lastEndTime - firstStartTime;
    const elapsed = now - firstStartTime;
    let progressPercentage = Math.min(95, Math.max(0, (elapsed / totalDuration) * 100));
    
    const containerWidth = container.clientWidth;
    let totalTimelineWidth = 0;
    timeline.querySelectorAll('.job').forEach(job => { totalTimelineWidth += job.offsetWidth + 6; });
    totalTimelineWidth += 24;
    if (totalTimelineWidth <= containerWidth) { container.scrollLeft = 0; return; }
    
    const scrollableWidth = totalTimelineWidth - containerWidth;
    const targetScrollPosition = (progressPercentage / 100) * scrollableWidth - containerWidth * 0.15;
    const clampedScroll = Math.max(0, Math.min(scrollableWidth, targetScrollPosition));
    const currentScroll = container.scrollLeft;
    if (Math.abs(currentScroll - clampedScroll) > containerWidth * 0.3) return;
    container.scrollTo({ left: clampedScroll, behavior: 'smooth' });
}

// ============================================================
// ZOOM FUNCTIONALITY
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
    updateZoomDisplay();
}

function smartZoomIn() {
    if (currentZoomLevel < MAX_ZOOM) {
        currentZoomLevel = Math.min(currentZoomLevel + ZOOM_STEP, MAX_ZOOM);
        applySmartZoom();
        updateZoomDisplay();
    }
}

function smartZoomOut() {
    if (currentZoomLevel > MIN_ZOOM) {
        currentZoomLevel = Math.max(currentZoomLevel - ZOOM_STEP, MIN_ZOOM);
        applySmartZoom();
        updateZoomDisplay();
    }
}

function smartResetZoom() {
    currentZoomLevel = 1.0;
    document.querySelectorAll('.timeline').forEach(timeline => {
        const container = timeline.closest('.timeline-container');
        if (container) {
            container.querySelectorAll('.timeline-ruler, .timeline-date-header').forEach(el => el.remove());
        }
        delete timelineStateCache[timeline.id];
        sortTimelineJobsByPriority(timeline);
        debouncedScaleTimeline(timeline.id);
    });
    updateZoomDisplay();
    updateAllNowIndicators();
    setTimeout(updateAllTimelineScrollPositions, 200);
}

let zoomTimeout = null;

function applySmartZoom() {
    if (zoomTimeout) clearTimeout(zoomTimeout);
    zoomTimeout = setTimeout(() => {
        document.querySelectorAll('.timeline').forEach(timeline => {
            const container = timeline.closest('.timeline-container');
            if (container) {
                container.querySelectorAll('.timeline-ruler, .timeline-date-header').forEach(el => el.remove());
            }
            delete timelineStateCache[timeline.id];
            scaleTimeline(timeline.id);
        });
        updateAllNowIndicators();
        setTimeout(updateAllTimelineScrollPositions, 200);
        zoomTimeout = null;
    }, 100);
}

function updateZoomDisplay() {
    const zoomLevelDisplay = document.getElementById('zoom-level');
    if (zoomLevelDisplay) {
        zoomLevelDisplay.textContent = Math.round(currentZoomLevel * 100) + '%';
    }
}

// ============================================================
// COMPLETED JOBS
// ============================================================
function updateCompletedJobs() {
    if (isUpdatingCompletedJobs) return;
    isUpdatingCompletedJobs = true;
    try {
        const now = new Date().getTime();
        let hasChanges = false;
        document.querySelectorAll('.timeline').forEach(timeline => {
            const jobs = timeline.querySelectorAll('.job:not(.job-printed)');
            jobs.forEach(job => {
                const jobId = job.getAttribute('data-job-id');
                if (!jobSchedule[jobId]) return;
                if (jobSchedule[jobId].endTime <= now && !jobSchedule[jobId].isPrinted) {
                    job.classList.add('job-printed');
                    jobSchedule[jobId].isPrinted = true;
                    job.setAttribute('draggable', 'false');
                    if (jobDatabase[jobId]) {
                        jobDatabase[jobId].planningStatus = 'Complete';
                        jobDatabase[jobId].isComplete = true;
                    }
                    if (plDatabase[jobId]) {
                        plDatabase[jobId].planningStatus = 'Complete';
                        plDatabase[jobId].isComplete = true;
                    }
                    const inputs = job.querySelectorAll('.job-editable-fields input');
                    inputs.forEach(input => {
                        input.disabled = true;
                        input.style.backgroundColor = '#e9ecef';
                        input.style.cursor = 'not-allowed';
                        input.style.opacity = '0.7';
                    });
                    hasChanges = true;
                }
            });
            const allPrintedJobs = Array.from(timeline.querySelectorAll('.job.job-printed'));
            if (allPrintedJobs.length > 1) {
                allPrintedJobs.sort((a, b) => {
                    const idA = a.getAttribute('data-job-id');
                    const idB = b.getAttribute('data-job-id');
                    return (jobSchedule[idB]?.endTime || 0) - (jobSchedule[idA]?.endTime || 0);
                });
                const toRemove = allPrintedJobs.slice(1);
                toRemove.forEach(job => {
                    const id = job.getAttribute('data-job-id');
                    delete jobSchedule[id];
                    job.remove();
                });
                hasChanges = true;
            }
            sortPrintedJobs(timeline);
            if (hasChanges) {
                delete timelineStateCache[timeline.id];
                const container = timeline.closest('.timeline-container');
                if (container) {
                    container.querySelectorAll('.timeline-ruler, .timeline-date-header').forEach(el => el.remove());
                }
                updateMachineStatus(timeline.closest('.machine'));
            }
        });
        if (hasChanges) {
            setTimeout(() => {
                document.querySelectorAll('.timeline').forEach(timeline => {
                    const container = timeline.closest('.timeline-container');
                    if (container) {
                        container.querySelectorAll('.timeline-ruler, .timeline-date-header').forEach(el => el.remove());
                        generateTimelineRuler(timeline);
                    }
                    updateNowIndicatorPosition(timeline);
                });
                updateStatistics();
                updateAllNowIndicators();
                updateAllJobColors();
                updateAllJobTimes();
                applySmartZoom();
            }, 500);
        }
    } catch (error) {
        console.error('❌ Error in updateCompletedJobs:', error);
    } finally {
        setTimeout(() => { isUpdatingCompletedJobs = false; }, 100);
    }
}

function sortPrintedJobs(timeline) {
    const printedJobs = [];
    const activeJobs = [];
    timeline.querySelectorAll('.job').forEach(job => {
        if (job.classList.contains('job-printed')) printedJobs.push(job);
        else activeJobs.push(job);
    });
    printedJobs.forEach(job => job.remove());
    activeJobs.forEach(job => job.remove());
    printedJobs.forEach(job => timeline.appendChild(job));
    activeJobs.forEach(job => timeline.appendChild(job));
}

function sortTimelineJobsByPriority(timeline) {
    if (!timeline) return;
    const activeJobs = Array.from(timeline.querySelectorAll('.job:not(.job-printed)'));
    if (activeJobs.length <= 1) return;
    
    activeJobs.sort((a, b) => {
        const aId = a.getAttribute('data-job-id');
        const bId = b.getAttribute('data-job-id');
        const aPriority = jobDatabase[aId]?.priority !== undefined ? jobDatabase[aId].priority : 999;
        const bPriority = jobDatabase[bId]?.priority !== undefined ? jobDatabase[bId].priority : 999;
        return aPriority - bPriority;
    });
    const printedJobs = Array.from(timeline.querySelectorAll('.job.job-printed'));
    while (timeline.firstChild) timeline.removeChild(timeline.firstChild);
    printedJobs.forEach(job => timeline.appendChild(job));
    activeJobs.forEach(job => timeline.appendChild(job));
}

// ============================================================
// START DYNAMIC TIME UPDATES
// ============================================================
function startDynamicTimeUpdates() {
    setInterval(() => {
        updateAllJobTimes();
        updateAllMachineStatuses();
        updateAllJobColors();
        updateAllTimelineScrollPositions();
    }, 5000);
    setInterval(updateCompletedJobs, 10000);
    setInterval(updateAllNowIndicators, 1000);
}

// ============================================================
// ENSURE RULERS EXIST
// ============================================================
function ensureRulersExist() {
    document.querySelectorAll('.timeline').forEach(timeline => {
        const container = timeline.closest('.timeline-container');
        if (container) {
            if (!container.querySelector('.timeline-ruler')) {
                generateTimelineRuler(timeline);
            }
            if (!container.querySelector('.ruler-now-marker')) {
                updateNowIndicatorPosition(timeline);
            }
        }
    });
}

// ============================================================
// SHOW JOB ON TIMELINE
// ============================================================
function showJobOnTimeline(jobId) {
    const jobElement = document.querySelector(`.job[data-job-id="${jobId}"]`);
    if (!jobElement) {
        showNotification(`⚠️ Job "${jobId}" is not on any timeline`, 'warning');
        return;
    }
    const timeline = jobElement.closest('.timeline');
    if (!timeline) { showNotification(`⚠️ Job not found on timeline`, 'warning'); return; }
    const machine = timeline.closest('.machine');
    if (!machine) { showNotification(`⚠️ Machine not found`, 'warning'); return; }
    const machineId = machine.getAttribute('data-machine') || timeline.id.replace('timeline-', '');
    const machinesContainer = document.getElementById('machines-scroll-container');
    if (!machinesContainer) { showNotification(`⚠️ Machines container not found`, 'warning'); return; }
    const machineElement = machinesContainer.querySelector(`.machine[data-machine="${machineId}"]`);
    if (!machineElement) {
        const altMachine = machinesContainer.querySelector(`#${timeline.id}`)?.closest('.machine');
        if (!altMachine) { showNotification(`⚠️ Machine ${machineId} not found`, 'warning'); return; }
        scrollToMachine(altMachine, jobElement);
        return;
    }
    scrollToMachine(machineElement, jobElement);
}

function scrollToMachine(machineElement, jobElement) {
    const machinesContainer = document.getElementById('machines-scroll-container');
    if (!machinesContainer) return;
    const timelineContainer = machineElement.querySelector('.timeline-container');
    if (!timelineContainer) {
        machinesContainer.scrollTo({ left: machineElement.offsetLeft - 20, behavior: 'smooth' });
        highlightJobAndMachine(jobElement, machineElement);
        return;
    }
    machinesContainer.scrollTo({ left: machineElement.offsetLeft - 20, behavior: 'smooth' });
    setTimeout(() => {
        const updatedJobRect = jobElement.getBoundingClientRect();
        const updatedContainerRect = timelineContainer.getBoundingClientRect();
        const jobCenter = updatedJobRect.left + (updatedJobRect.width / 2);
        const containerCenter = updatedContainerRect.left + (updatedContainerRect.width / 2);
        const scrollOffset = jobCenter - containerCenter;
        timelineContainer.scrollTo({ left: timelineContainer.scrollLeft + scrollOffset - (updatedJobRect.width / 2), behavior: 'smooth' });
    }, 350);
    setTimeout(() => highlightJobAndMachine(jobElement, machineElement), 700);
}

function highlightJobAndMachine(jobElement, machineElement) {
    jobElement.classList.add('job-highlighted');
    if (window.jobHighlightTimeout) clearTimeout(window.jobHighlightTimeout);
    window.jobHighlightTimeout = setTimeout(() => jobElement.classList.remove('job-highlighted'), 5000);
    machineElement.classList.add('machine-highlighted');
    setTimeout(() => machineElement.classList.remove('machine-highlighted'), 5000);
    const jobName = jobDatabase[jobElement.getAttribute('data-job-id')]?.name || 'Job';
    const machineId = machineElement.getAttribute('data-machine') || 'Unknown';
    const priority = jobDatabase[jobElement.getAttribute('data-job-id')]?.priority || 'N/A';
    showNotification(`🔍 "${jobName}" on Machine ${machineId} (Priority: ${priority})`, 'info');
}

// ============================================================
// REFRESH ALL TIMELINES
// ============================================================
function refreshAllTimelines() {
    document.querySelectorAll('.timeline').forEach(timeline => {
        const container = timeline.closest('.timeline-container');
        if (container) {
            container.querySelectorAll('.timeline-ruler, .timeline-date-header').forEach(el => el.remove());
        }
        delete timelineStateCache[timeline.id];
        sortPrintedJobs(timeline);
        const activeJobs = Array.from(timeline.querySelectorAll('.job:not(.job-printed)'));
        if (activeJobs.length > 1) {
            activeJobs.sort((a, b) => {
                const aId = a.getAttribute('data-job-id');
                const bId = b.getAttribute('data-job-id');
                const aPriority = jobDatabase[aId]?.priority !== undefined ? jobDatabase[aId].priority : 999;
                const bPriority = jobDatabase[bId]?.priority !== undefined ? jobDatabase[bId].priority : 999;
                return aPriority - bPriority;
            });
            const printed = Array.from(timeline.querySelectorAll('.job.job-printed'));
            while (timeline.firstChild) timeline.removeChild(timeline.firstChild);
            printed.forEach(job => timeline.appendChild(job));
            activeJobs.forEach(job => timeline.appendChild(job));
        }
        rescheduleTimelineJobs(timeline.id, true);
        debouncedScaleTimeline(timeline.id);
    });
    updateAllNowIndicators();
    updateAllJobColors();
    updateAllJobTimes();
    updateAllMachineStatuses();
}

// ============================================================
// EXPOSE FUNCTIONS
// ============================================================
window.jobSchedule = jobSchedule;
window.jobSpeeds = jobSpeeds;
window.machineConfig = machineConfig;
window.calculateJobDuration = calculateJobDuration;
window.rescheduleTimelineJobs = rescheduleTimelineJobs;
window.scaleTimeline = scaleTimeline;
window.debouncedScaleTimeline = debouncedScaleTimeline;
window.updateAllJobColors = updateAllJobColors;
window.updateCompletedJobs = updateCompletedJobs;
window.updateAllTimelineScrollPositions = updateAllTimelineScrollPositions;
window.smartZoomIn = smartZoomIn;
window.smartZoomOut = smartZoomOut;
window.smartResetZoom = smartResetZoom;
window.currentZoomLevel = currentZoomLevel;
window.refreshAllTimelines = refreshAllTimelines;
window.sortPrintedJobs = sortPrintedJobs;
window.sortTimelineJobsByPriority = sortTimelineJobsByPriority;
window.updateNowIndicatorPosition = updateNowIndicatorPosition;
window.updateAllNowIndicators = updateAllNowIndicators;
window.initializeNowIndicators = initializeNowIndicators;
window.setupNowIndicatorPersistence = setupNowIndicatorPersistence;
window.setupResizeObserver = setupResizeObserver;
window.nowIndicatorPositions = nowIndicatorPositions;
window.clearTimelineCache = clearTimelineCache;
window.timelineStateCache = timelineStateCache;
window.showJobOnTimeline = showJobOnTimeline;
window.ensureRulersExist = ensureRulersExist;
window.generateTimelineRuler = generateTimelineRuler;
window.handleFeedToTimeline = handleFeedToTimeline;
window.handleJobReorder = handleJobReorder;
window.returnJobToFeed = returnJobToFeed;
window.addJobToTimelineWithSchedule = addJobToTimelineWithSchedule;
window.startDynamicTimeUpdates = startDynamicTimeUpdates;
window.applySmartZoom = applySmartZoom;
window.updateMachineStatus = updateMachineStatus;
window.updateAllMachineStatuses = updateAllMachineStatuses;
window.setupDragAndDrop = setupDragAndDrop;
window.getDragAfterElement = getDragAfterElement;
window.forceCompleteCheck = forceCompleteCheck;
window.saveSchedulesImmediately = saveSchedulesImmediately;
window.forceTimelineRefresh = forceTimelineRefresh;
window.forceCompleteRepaint = forceCompleteRepaint;

console.log('✅ timeline.js loaded - Complete with force repaint fix');
