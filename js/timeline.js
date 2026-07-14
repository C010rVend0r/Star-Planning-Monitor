// timeline.js
// ============================================================
// TIMELINE & MACHINE FUNCTIONS
// ============================================================

// ============================================================
// CONFIGURATION
// ============================================================
const RULER_SHIFT_OFFSET = 30; // Pixel offset to align ruler ticks with job badges

// ============================================================
// MACHINE CONFIGURATION
// ============================================================
const machineConfig = {
    speed: 200,
    defaultSetup: 120
};

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

// ============================================================
// TIMELINE RULER - WITH OFFSET ADJUSTMENT
// ============================================================

// ============================================================
// TIMELINE RULER - FIXED: Uses clientWidth as reference
// ============================================================

function generateTimelineRuler(timeline) {
    const container = timeline.closest('.timeline-container');
    if (!container) return;
    
    // Remove existing ruler elements
    const existingRuler = container.querySelector('.timeline-ruler');
    if (existingRuler) existingRuler.remove();
    const existingDateHeader = container.querySelector('.timeline-date-header');
    if (existingDateHeader) existingDateHeader.remove();
    
    const jobs = timeline.querySelectorAll('.job');
    if (jobs.length === 0) return;
    
    // CRITICAL FIX: Use container.clientWidth as the reference
    // This stays constant regardless of how many jobs are in the container
    const containerWidth = container.clientWidth || 800;
    const totalWidth = containerWidth;  // Fixed reference width
    
    // Get the container's bounding rect for reference
    const containerRect = container.getBoundingClientRect();
    
    // Get the actual pixel position of each job relative to the container
    let jobPositions = [];
    
    jobs.forEach(job => {
        const jobId = job.getAttribute('data-job-id');
        const scheduleData = jobSchedule[jobId];
        
        if (scheduleData) {
            const jobRect = job.getBoundingClientRect();
            const leftPx = jobRect.left - containerRect.left + container.scrollLeft + RULER_SHIFT_OFFSET;
            const rightPx = jobRect.right - containerRect.left + container.scrollLeft + RULER_SHIFT_OFFSET;
            
            jobPositions.push({
                id: jobId,
                startTime: scheduleData.startTime,
                endTime: scheduleData.endTime,
                leftPx: leftPx,
                rightPx: rightPx,
                isPrinted: job.classList.contains('job-printed')
            });
        }
    });
    
    if (jobPositions.length === 0) return;
    
    // Create date header
    const dateHeader = document.createElement('div');
    dateHeader.className = 'timeline-date-header';
    const firstJobStart = jobPositions[0].startTime;
    const lastJobEnd = jobPositions[jobPositions.length - 1].endTime;
    const startDate = new Date(firstJobStart);
    const endDate = new Date(lastJobEnd);
    const today = new Date();
    
    dateHeader.innerHTML = `
        <span class="date-range">
           ${startDate.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })} 
            → ${endDate.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
        </span>
        <span class="today-date">
            Today: ${today.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
        </span>
    `;
    
    // Create ruler with the same width as the container
    const ruler = document.createElement('div');
    ruler.className = 'timeline-ruler';
    ruler.style.cssText = `
        position: relative;
        width: 100%;
        min-width: ${totalWidth}px;
        height: 34px;
        background: rgb(175, 178, 185);
        border-bottom: 2px solid #dee2e6;
        border-radius: 4px 4px 0 0;
        margin-bottom: 2px;
        flex-shrink: 0;
        overflow: visible;
        z-index: 2;
        box-sizing: border-box;
    `;
    
    // For each job, add a start tick at the left edge and end tick at the right edge
    jobPositions.forEach((pos, index) => {
        const startPercent = (pos.leftPx / totalWidth) * 100;
        const endPercent = (pos.rightPx / totalWidth) * 100;
        
        const clampedStart = Math.max(0.5, Math.min(99.5, startPercent));
        const clampedEnd = Math.max(0.5, Math.min(99.5, endPercent));
        
        const startDateObj = new Date(pos.startTime);
        const endDateObj = new Date(pos.endTime);
        
        const startTimeStr = startDateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const endTimeStr = endDateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const startDateStr = startDateObj.toLocaleDateString([], { month: 'short', day: 'numeric' });
        const endDateStr = endDateObj.toLocaleDateString([], { month: 'short', day: 'numeric' });
        
        const showStartDate = index === 0 || startDateObj.getDate() !== new Date(jobPositions[index - 1].startTime).getDate();
        const showEndDate = index === jobPositions.length - 1 || endDateObj.getDate() !== new Date(jobPositions[index + 1].startTime).getDate();
        
        // START TICK
        const startTick = document.createElement('div');
        startTick.className = 'ruler-tick start-tick';
        startTick.style.cssText = `
            position: absolute;
            top: 0;
            height: 100%;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: flex-start;
            padding-top: 2px;
            transform: translateX(-50%);
            white-space: nowrap;
            z-index: 3;
            pointer-events: none;
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            left: ${clampedStart}%;
            border-left: 2px solid #777777;
        `;
        startTick.innerHTML = `
            <span class="tick-time" style="font-size:9px; font-weight:700; color:#2c3e50; background:rgb(175, 178, 185); padding:0 4px; border-radius:2px; line-height:1.3; margin-top:2px;">
                ▶ ${startTimeStr}
            </span>
            ${showStartDate ? `<span class="tick-date" style="font-size:7px; color:#6c757d; background:rgb(175, 178, 185); padding:0 4px; border-radius:2px; line-height:1.2;">${startDateStr}</span>` : ''}
        `;
        ruler.appendChild(startTick);
        
        // END TICK
        const endTick = document.createElement('div');
        endTick.className = 'ruler-tick end-tick';
        endTick.style.cssText = `
            position: absolute;
            top: 0;
            height: 100%;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: flex-start;
            padding-top: 2px;
            transform: translateX(-50%);
            white-space: nowrap;
            z-index: 3;
            pointer-events: none;
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            left: ${clampedEnd}%;
            border-left: 2px solid #777777;
        `;
        endTick.innerHTML = `
            <span class="tick-time" style="font-size:9px; font-weight:700; color:#e74c3c; background:rgb(175, 178, 185); padding:0 4px; border-radius:2px; line-height:1.3; margin-top:2px;">
                ■ ${endTimeStr}
            </span>
            ${showEndDate ? `<span class="tick-date" style="font-size:7px; color:#6c757d; background:rgb(175, 178, 185); padding:0 4px; border-radius:2px; line-height:1.2;">${endDateStr}</span>` : ''}
        `;
        ruler.appendChild(endTick);
    });
    
    // Add boundary lines between jobs (using raw position without offset)
    for (let i = 1; i < jobPositions.length; i++) {
        const pos = jobPositions[i];
        const jobElement = document.querySelector(`.job[data-job-id="${pos.id}"]`);
        if (!jobElement) continue;
        
        const jobRect = jobElement.getBoundingClientRect();
        // Calculate position WITHOUT the shift offset
        const rawLeftPx = jobRect.left - containerRect.left + container.scrollLeft;
        const boundaryPercent = (rawLeftPx / totalWidth) * 100;
        const clampedBoundary = Math.max(0.5, Math.min(99.5, boundaryPercent));
        
        const boundaryLine = document.createElement('div');
        boundaryLine.style.cssText = `
            position: absolute;
            top: 0;
            height: 100%;
            width: 1px;
            background: rgba(0, 0, 0, 0.08);
            pointer-events: none;
            z-index: 1;
            left: ${clampedBoundary}%;
        `;
        ruler.appendChild(boundaryLine);
    }
    
    // Insert date header and ruler BEFORE the timeline
    try {
        container.insertBefore(dateHeader, timeline);
        container.insertBefore(ruler, timeline);
    } catch (e) {
        container.appendChild(dateHeader);
        container.appendChild(ruler);
    }
    
    // Update now indicator position after ruler is created
    updateNowIndicatorPosition(timeline);
}

// ============================================================
// NOW INDICATOR - FIXED: Uses clientWidth as reference
// ============================================================

// Store the last calculated position for each timeline
const nowIndicatorPositions = {};

function updateNowIndicatorPosition(timeline) {
    const now = new Date();
    const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const nowTime = now.getTime();
    
    const container = timeline.closest('.timeline-container');
    if (!container) return;
    
    const ruler = container.querySelector('.timeline-ruler');
    if (!ruler) return;
    
    const jobs = timeline.querySelectorAll('.job:not(.job-printed)');
    if (jobs.length === 0) {
        const marker = ruler.querySelector('.ruler-now-marker');
        if (marker) marker.remove();
        delete nowIndicatorPositions[timeline.id];
        return;
    }
    
    // CRITICAL FIX: Use container.clientWidth as the reference
    const containerRect = container.getBoundingClientRect();
    const totalWidth = container.clientWidth || 800;
    
    let positionPercentage = 5;
    let foundPosition = false;
    
    // Get the first and last job for boundaries
    const firstJob = jobs[0];
    const lastJob = jobs[jobs.length - 1];
    const firstJobId = firstJob.getAttribute('data-job-id');
    const lastJobId = lastJob.getAttribute('data-job-id');
    
    if (!jobSchedule[firstJobId] || !jobSchedule[lastJobId]) {
        const marker = ruler.querySelector('.ruler-now-marker');
        if (marker) marker.remove();
        return;
    }
    
    const firstStart = jobSchedule[firstJobId].startTime;
    const lastEnd = jobSchedule[lastJobId].endTime;
    
    // Use RAW pixel position WITHOUT the shift offset (matches boundary lines)
    for (let i = 0; i < jobs.length; i++) {
        const job = jobs[i];
        const jobId = job.getAttribute('data-job-id');
        const schedule = jobSchedule[jobId];
        
        if (!schedule) continue;
        
        const jobStart = schedule.startTime;
        const jobEnd = schedule.endTime;
        
        // Get RAW pixel position WITHOUT the shift offset
        const jobRect = job.getBoundingClientRect();
        const leftPx = jobRect.left - containerRect.left + container.scrollLeft;  // NO OFFSET
        const rightPx = jobRect.right - containerRect.left + container.scrollLeft; // NO OFFSET
        
        if (nowTime >= jobStart && nowTime <= jobEnd) {
            const jobDuration = jobEnd - jobStart;
            const elapsed = nowTime - jobStart;
            const jobProgress = jobDuration > 0 ? elapsed / jobDuration : 0;
            
            const pos = leftPx + (jobProgress * (rightPx - leftPx));
            positionPercentage = (pos / totalWidth) * 100;
            foundPosition = true;
            break;
        }
        
        // Check if current time is between jobs
        if (i < jobs.length - 1) {
            const nextJob = jobs[i + 1];
            const nextJobId = nextJob.getAttribute('data-job-id');
            const nextSchedule = jobSchedule[nextJobId];
            
            if (nextSchedule && nowTime > jobEnd && nowTime < nextSchedule.startTime) {
                const nextJobRect = nextJob.getBoundingClientRect();
                const nextLeftPx = nextJobRect.left - containerRect.left + container.scrollLeft; // NO OFFSET
                
                const gapStart = jobEnd;
                const gapEnd = nextSchedule.startTime;
                const gapDuration = gapEnd - gapStart;
                const gapElapsed = nowTime - gapStart;
                const gapProgress = gapDuration > 0 ? gapElapsed / gapDuration : 0;
                
                const pos = rightPx + (gapProgress * (nextLeftPx - rightPx));
                positionPercentage = (pos / totalWidth) * 100;
                foundPosition = true;
                break;
            }
        }
    }
    
    // If not found, position at edges
    if (!foundPosition) {
        if (nowTime < firstStart) {
            positionPercentage = 2;
        } else if (nowTime > lastEnd) {
            positionPercentage = 98;
        } else {
            const totalDuration = lastEnd - firstStart;
            let progress = (nowTime - firstStart) / totalDuration;
            progress = Math.max(0, Math.min(1, progress));
            positionPercentage = 2 + (progress * 96);
        }
    }
    
    positionPercentage = Math.max(1, Math.min(99, positionPercentage));
    
    // Store for debugging
    nowIndicatorPositions[timeline.id] = {
        position: positionPercentage,
        time: timeString,
        totalWidth: totalWidth,
        jobs: jobs.length,
        foundPosition: foundPosition
    };
    
    // Get or create marker
    let marker = ruler.querySelector('.ruler-now-marker');
    if (!marker) {
        marker = document.createElement('div');
        marker.className = 'ruler-now-marker';
        ruler.appendChild(marker);
    }
    
    // Apply position
    marker.style.cssText = `
        position: absolute !important;
        top: 0 !important;
        height: 100% !important;
        width: 2px !important;
        background: #e74c3c !important;
        transform: translateX(-50%) !important;
        z-index: 6 !important;
        pointer-events: none !important;
        display: block !important;
        left: ${positionPercentage}% !important;
    `;
    
    // Update label
    let label = marker.querySelector('.ruler-now-label');
    if (!label) {
        label = document.createElement('span');
        label.className = 'ruler-now-label';
        marker.appendChild(label);
    }
    
    label.style.cssText = `
        position: absolute !important;
        top: -16px !important;
        left: 50% !important;
        transform: translateX(-50%) !important;
        font-size: 8px !important;
        font-weight: 700 !important;
        color: #e74c3c !important;
        background: white !important;
        padding: 0 8px !important;
        border-radius: 3px !important;
        white-space: nowrap !important;
        box-shadow: 0 1px 4px rgba(0,0,0,0.1) !important;
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif !important;
        display: block !important;
    `;
    label.textContent = `NOW>> ${timeString}`;
}

function updateAllNowIndicators() {
    document.querySelectorAll('.timeline').forEach(timeline => {
        updateNowIndicatorPosition(timeline);
    });
}

function initializeNowIndicators() {
    // Clear any existing interval
    if (nowIndicatorInterval) {
        clearInterval(nowIndicatorInterval);
        nowIndicatorInterval = null;
    }
    
    // Update once with a small delay to ensure DOM is ready
    setTimeout(() => {
        updateAllNowIndicators();
    }, 500);
    
    // Update every 30 seconds
    nowIndicatorInterval = setInterval(updateAllNowIndicators, 30000);
}

// Debug function
function debugNowIndicators() {
    console.log('=== Now Indicator Debug ===');
    for (const [timelineId, data] of Object.entries(nowIndicatorPositions)) {
        console.log(`${timelineId}: ${data.position.toFixed(2)}% (${data.time}) - ${data.jobs} jobs, found: ${data.foundPosition}`);
    }
    console.log('============================');
}
window.debugNowIndicators = debugNowIndicators;

// ============================================================
// SCALE TIMELINE - Independent zoom per timeline
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
        return;
    }
    
    // Separate printed and active jobs
    const printedJobs = [];
    const activeJobs = [];
    
    jobs.forEach(job => {
        if (job.classList.contains('job-printed')) {
            printedJobs.push(job);
        } else {
            activeJobs.push(job);
        }
    });
    
    // Calculate durations for active jobs only
    const jobDurations = [];
    let minDuration = Infinity;
    let maxDuration = 0;
    
    activeJobs.forEach(job => {
        const jobId = job.getAttribute('data-job-id');
        const duration = calculateJobDuration(jobDatabase[jobId], jobId);
        jobDurations.push({ job, duration, jobId });
        if (duration > maxDuration) maxDuration = duration;
        if (duration < minDuration) minDuration = duration;
    });
    
    // If no active jobs, just style printed jobs with fixed width
    if (activeJobs.length === 0) {
        printedJobs.forEach(job => {
            let width = 100 * currentZoomLevel;
            width = Math.max(80, Math.min(250, width));
            applyJobStyle(job, width);
        });
        return;
    }
    
    const MIN_JOB_WIDTH = 80;
    const MAX_JOB_WIDTH = 600;
    const MIN_DURATION_FOR_SCALING = 1;
    
    const effectiveMinDuration = Math.max(minDuration, MIN_DURATION_FOR_SCALING);
    let pixelsPerMinute = MIN_JOB_WIDTH / effectiveMinDuration;
    pixelsPerMinute = pixelsPerMinute * currentZoomLevel;
    pixelsPerMinute = Math.max(0.5, Math.min(20, pixelsPerMinute));
    
    jobDurations.forEach(({ job, duration }) => {
        let width = duration * pixelsPerMinute;
        width = Math.max(MIN_JOB_WIDTH * 0.8, Math.min(MAX_JOB_WIDTH * 1.2, width));
        applyJobStyle(job, width);
    });
    
    printedJobs.forEach(job => {
        let width = 100 * currentZoomLevel;
        width = Math.max(80, Math.min(250, width));
        applyJobStyle(job, width);
    });
    
    // Generate ruler if we have schedule data
    let hasSchedule = false;
    let firstStartTime = Infinity;
    let lastEndTime = 0;
    
    activeJobs.forEach(job => {
        const jobId = job.getAttribute('data-job-id');
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
    
    if (hasSchedule && firstStartTime !== Infinity && lastEndTime > 0) {
        generateTimelineRuler(timeline);
    }
}

function applyJobStyle(job, jobWidth) {
    jobWidth = Math.round(jobWidth * 10) / 10;
    
    const minWidth = 100;
    const maxWidth = 600;
    jobWidth = Math.max(minWidth, Math.min(maxWidth, jobWidth));
    
    job.style.width = `${jobWidth}px`;
    job.style.flexShrink = '0';
    job.style.minWidth = `${minWidth}px`;
    job.style.maxWidth = `${maxWidth}px`;
    
    const fontSize = Math.max(9, Math.min(14, 11 * currentZoomLevel));
    const nameFontSize = Math.max(9, Math.min(13, 10 * currentZoomLevel));
    const badgeFontSize = Math.max(11, Math.min(16, 13 * currentZoomLevel));
    
    const jobName = job.querySelector('.job-name');
    if (jobName) {
        jobName.style.fontSize = `${nameFontSize}px`;
        const badge = jobName.querySelector('.job-number-badge');
        if (badge) {
            badge.style.fontSize = `${badgeFontSize}px`;
            badge.style.fontWeight = '700';
        }
    }
    
    const jobDetails = job.querySelector('.job-details');
    if (jobDetails) jobDetails.style.fontSize = `${fontSize * 0.85}px`;
    
    const jobDurationEl = job.querySelector('.job-duration');
    if (jobDurationEl) jobDurationEl.style.fontSize = `${fontSize * 1.1}px`;
    
    const jobBreakdown = job.querySelector('.job-breakdown');
    if (jobBreakdown) jobBreakdown.style.fontSize = `${fontSize * 0.75}px`;
    
    const jobTime = job.querySelector('.job-time');
    if (jobTime) jobTime.style.fontSize = `${fontSize * 0.75}px`;
    
    const padding = Math.max(6, Math.min(12, 8 * currentZoomLevel));
    job.style.padding = `${padding}px ${padding * 1.2}px`;
}

// ============================================================
// TIMELINE SCHEDULING
// ============================================================

function rescheduleTimelineJobs(timelineId) {
    const timeline = document.getElementById(timelineId);
    if (!timeline) return;
    
    const printedJobs = timeline.querySelectorAll('.job.job-printed');
    const activeJobs = timeline.querySelectorAll('.job:not(.job-printed)');
    
    if (activeJobs.length === 0) return;
    
    let currentTime = new Date().getTime();
    
    if (printedJobs.length > 0) {
        const lastPrinted = printedJobs[printedJobs.length - 1];
        const lastPrintedId = lastPrinted.getAttribute('data-job-id');
        if (jobSchedule[lastPrintedId]) {
            currentTime = Math.max(currentTime, jobSchedule[lastPrintedId].endTime);
        }
    }
    
    activeJobs.forEach(job => {
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
    return Math.round((jobData.setup + printingTime) * 100) / 100;
}

// ============================================================
// TIMELINE OPERATIONS
// ============================================================

function addJobToTimelineWithSchedule(jobId, timelineId, startTime, insertBeforeElement) {
    const timeline = document.getElementById(timelineId);
    if (!timeline) return;
    
    const jobData = jobDatabase[jobId];
    if (!jobData) return;
    
    const jobElement = createJobElement(jobId, jobData);
    
    const machineNumber = timelineId.replace('timeline-', '');
    jobData.machine = machineNumber;
    if (plDatabase[jobId]) {
        plDatabase[jobId].machine = machineNumber;
    }
    
    const duration = calculateJobDuration(jobData, jobId);
    const endTime = startTime + duration * 60000;
    
    jobSchedule[jobId] = {
        startTime: startTime,
        endTime: endTime,
        timelineId: timelineId,
        isPrinted: false
    };
    
    if (insertBeforeElement) {
        timeline.insertBefore(jobElement, insertBeforeElement);
    } else {
        const firstPrinted = timeline.querySelector('.job.job-printed');
        if (firstPrinted) {
            timeline.insertBefore(jobElement, firstPrinted);
        } else {
            timeline.appendChild(jobElement);
        }
    }
    
    rescheduleTimelineJobs(timelineId);
    scaleTimeline(timelineId);
    updateMachineStatus(timeline.closest('.machine'));
    updateJobTimeDisplay(jobId);
    updateAllJobColors();
    updateStatistics();
    applySmartZoom();
    setTimeout(() => updateAllTimelineScrollPositions(), 300);
}

// ============================================================
// HANDLE FEED TO TIMELINE
// ============================================================

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
    
    const jobs = timeline.querySelectorAll('.job:not(.job-printed)');
    let newStartTime;
    let insertBeforeElement = null;
    
    if (jobs.length > 0) {
        const afterElement = getDragAfterElement(timeline, e.clientX);
        if (afterElement) {
            insertBeforeElement = afterElement;
            const insertIndex = Array.from(timeline.children).indexOf(afterElement);
            const prevJob = insertIndex > 0 ? timeline.children[insertIndex - 1] : null;
            if (prevJob && prevJob.classList.contains('job') && !prevJob.classList.contains('job-printed')) {
                const prevJobId = prevJob.getAttribute('data-job-id');
                newStartTime = jobSchedule[prevJobId]?.endTime || new Date().getTime();
            } else {
                const firstPrinted = timeline.querySelector('.job.job-printed');
                if (firstPrinted) {
                    const printedJobs = timeline.querySelectorAll('.job.job-printed');
                    const lastPrinted = printedJobs[printedJobs.length - 1];
                    if (lastPrinted) {
                        const lastPrintedId = lastPrinted.getAttribute('data-job-id');
                        newStartTime = jobSchedule[lastPrintedId]?.endTime || new Date().getTime();
                    } else {
                        newStartTime = new Date().getTime();
                    }
                } else {
                    newStartTime = new Date().getTime();
                }
            }
        } else {
            const lastJobId = jobs[jobs.length - 1].getAttribute('data-job-id');
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

// ============================================================
// HANDLE JOB REORDER
// ============================================================

function handleJobReorder(jobId, targetTimeline, e) {
    const oldTimeline = draggedElement.parentElement;
    const afterElement = getDragAfterElement(targetTimeline, e.clientX);
    let insertBeforeElement = null;
    
    draggedElement.remove();
    
    const machineNumber = targetTimeline.id.replace('timeline-', '');
    if (jobDatabase[jobId]) {
        jobDatabase[jobId].machine = machineNumber;
    }
    if (plDatabase[jobId]) {
        plDatabase[jobId].machine = machineNumber;
    }
    
    if (afterElement) {
        insertBeforeElement = afterElement;
        targetTimeline.insertBefore(draggedElement, afterElement);
    } else {
        const firstPrinted = targetTimeline.querySelector('.job.job-printed');
        if (firstPrinted) {
            targetTimeline.insertBefore(draggedElement, firstPrinted);
        } else {
            targetTimeline.appendChild(draggedElement);
        }
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
// RETURN JOB TO FEED
// ============================================================

function returnJobToFeed(jobElement) {
    const jobId = jobElement.getAttribute('data-job-id');
    const jobData = jobDatabase[jobId];
    if (!jobData) return;
    
    delete jobSpeeds[jobId];
    updateJobPLStatus(jobId, 'Unprinted');
    
    jobData.machine = '';
    if (plDatabase[jobId]) {
        plDatabase[jobId].machine = '';
    }
    
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

function refreshAllTimelines() {
    document.querySelectorAll('.timeline').forEach(timeline => {
        const container = timeline.closest('.timeline-container');
        if (container) {
            container.querySelectorAll('.timeline-ruler, .timeline-date-header').forEach(el => el.remove());
        }
        sortPrintedJobs(timeline);
        scaleTimeline(timeline.id);
    });
}

function sortPrintedJobs(timeline) {
    const printedJobs = [];
    const activeJobs = [];
    
    timeline.querySelectorAll('.job').forEach(job => {
        if (job.classList.contains('job-printed')) {
            printedJobs.push(job);
        } else {
            activeJobs.push(job);
        }
    });
    
    printedJobs.forEach(job => job.remove());
    activeJobs.forEach(job => job.remove());
    
    printedJobs.forEach(job => timeline.appendChild(job));
    activeJobs.forEach(job => timeline.appendChild(job));
}

// ============================================================
// TIMELINE SCROLLING
// ============================================================

function startTimelineScrolling() {
    if (timelineScrollInterval) {
        clearInterval(timelineScrollInterval);
    }
    timelineScrollInterval = setInterval(updateAllTimelineScrollPositions, 5000);
    setTimeout(updateAllTimelineScrollPositions, 1000);
    
    document.querySelectorAll('.timeline-container').forEach(container => {
        container.addEventListener('scroll', function() {
            if (autoScrollEnabled) {
                autoScrollEnabled = false;
                clearTimeout(window.autoScrollTimeout);
                window.autoScrollTimeout = setTimeout(() => {
                    autoScrollEnabled = true;
                    showAutoScrollIndicator('Auto-scroll resumed');
                }, 30000);
                showAutoScrollIndicator('Auto-scroll paused (manual scroll detected)');
            }
        }, { passive: true });
    });
}

function updateAllTimelineScrollPositions() {
    document.querySelectorAll('.timeline').forEach(timeline => {
        updateTimelineScrollPosition(timeline);
    });
}

function updateTimelineScrollPosition(timeline) {
    const container = timeline.closest('.timeline-container');
    if (!container) return;
    if (!autoScrollEnabled) return;
    
    const now = new Date().getTime();
    const jobs = timeline.querySelectorAll('.job:not(.job-printed)');
    
    if (jobs.length === 0) {
        container.scrollLeft = 0;
        return;
    }
    
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
    let progressPercentage = Math.min(95, Math.max(0, (elapsed / totalDuration) * 100));
    
    const containerWidth = container.clientWidth;
    let totalTimelineWidth = 0;
    const allJobs = timeline.querySelectorAll('.job');
    allJobs.forEach(job => {
        totalTimelineWidth += job.offsetWidth + 6;
    });
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
    
    if (scrollDiff > containerWidth * 0.3) return;
    
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
// DRAG AND DROP
// ============================================================

function setupDragAndDrop() {
    console.log('Setting up drag and drop with enhanced features...');
    
    let dragScrollInterval = null;
    const SCROLL_SPEED = 15;
    const SCROLL_MARGIN = 80;
    
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
    });
    
    document.querySelectorAll('.timeline').forEach(timeline => {
        const container = timeline.closest('.timeline-container');
        if (!container) return;
        
        timeline.addEventListener('dragover', function(e) {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            
            const containerRect = container.getBoundingClientRect();
            const mouseX = e.clientX;
            const margin = SCROLL_MARGIN;
            
            if (mouseX < containerRect.left + margin) {
                if (!dragScrollInterval) {
                    dragScrollInterval = setInterval(() => {
                        container.scrollLeft -= SCROLL_SPEED;
                    }, 16);
                }
            } else if (mouseX > containerRect.right - margin) {
                if (!dragScrollInterval) {
                    dragScrollInterval = setInterval(() => {
                        container.scrollLeft += SCROLL_SPEED;
                    }, 16);
                }
            } else {
                if (dragScrollInterval) {
                    clearInterval(dragScrollInterval);
                    dragScrollInterval = null;
                }
            }
            
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
    // Recalculate now indicator after zoom
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
        
        const printedJobs = timeline.querySelectorAll('.job.job-printed');
        if (printedJobs.length > 5) {
            const toRemove = Array.from(printedJobs).slice(5);
            toRemove.forEach(job => {
                const jobId = job.getAttribute('data-job-id');
                delete jobSchedule[jobId];
                job.remove();
            });
        }
        
        sortPrintedJobs(timeline);
        updateMachineStatus(timeline.closest('.machine'));
        updateStatistics();
    });
}

// ============================================================
// EXPOSE FUNCTIONS TO WINDOW
// ============================================================
window.jobSchedule = jobSchedule;
window.jobSpeeds = jobSpeeds;
window.machineConfig = machineConfig;
window.calculateJobDuration = calculateJobDuration;
window.rescheduleTimelineJobs = rescheduleTimelineJobs;
window.scaleTimeline = scaleTimeline;
window.updateAllJobColors = updateAllJobColors;
window.updateCompletedJobs = updateCompletedJobs;
window.updateAllTimelineScrollPositions = updateAllTimelineScrollPositions;
window.smartZoomIn = smartZoomIn;
window.smartZoomOut = smartZoomOut;
window.smartResetZoom = smartResetZoom;
window.currentZoomLevel = currentZoomLevel;
window.refreshAllTimelines = refreshAllTimelines;
window.sortPrintedJobs = sortPrintedJobs;
window.updateNowIndicatorPosition = updateNowIndicatorPosition;
window.updateAllNowIndicators = updateAllNowIndicators;
window.initializeNowIndicators = initializeNowIndicators;
window.debugNowIndicators = debugNowIndicators;
