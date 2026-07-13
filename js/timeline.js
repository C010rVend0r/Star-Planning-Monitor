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
    
    // Get container dimensions
    const containerWidth = container.clientWidth || 800;
    const timelineScrollWidth = timeline.scrollWidth || timeline.offsetWidth || 800;
    const totalWidth = Math.max(timelineScrollWidth, containerWidth);
    
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
    
    // Create ruler with the same width as the timeline
    const ruler = document.createElement('div');
    ruler.className = 'timeline-ruler';
    ruler.style.cssText = `
        position: relative;
        width: 100%;
        min-width: ${totalWidth}px;
        height: 34px;
        background: #f8f9fa;
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
            border-left: 2px solid #b1b1b1;
        `;
        startTick.innerHTML = `
            <span class="tick-time" style="font-size:9px; font-weight:700; color:#2c3e50; background:#f8f9fa; padding:0 4px; border-radius:2px; line-height:1.3; margin-top:2px;">
                ▶ ${startTimeStr}
            </span>
            ${showStartDate ? `<span class="tick-date" style="font-size:7px; color:#6c757d; background:#f8f9fa; padding:0 4px; border-radius:2px; line-height:1.2;">${startDateStr}</span>` : ''}
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
            border-left: 2px solid #b1b1b1;
        `;
        endTick.innerHTML = `
            <span class="tick-time" style="font-size:9px; font-weight:700; color:#e74c3c; background:#f8f9fa; padding:0 4px; border-radius:2px; line-height:1.3; margin-top:2px;">
                ■ ${endTimeStr}
            </span>
            ${showEndDate ? `<span class="tick-date" style="font-size:7px; color:#6c757d; background:#f8f9fa; padding:0 4px; border-radius:2px; line-height:1.2;">${endDateStr}</span>` : ''}
        `;
        ruler.appendChild(endTick);
    });
    
    // Add boundary lines between jobs
    for (let i = 1; i < jobPositions.length; i++) {
        const pos = jobPositions[i];
        const boundaryPercent = (pos.leftPx / totalWidth) * 100;
        const clampedBoundary = Math.max(0.5, Math.min(99.5, boundaryPercent));
        
        const boundaryLine = document.createElement('div');
        boundaryLine.style.cssText = `
            position: absolute;
            top: 0;
            height: 100%;
            width: 1px;
            background: rgba(0,0,0,0.08);
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
    setTimeout(() => {
        updateNowIndicatorPosition(timeline);
    }, 50);
}

// ============================================================
// NOW INDICATOR
// ============================================================

function initializeNowIndicators() {
    // Just update all now indicator positions
    // The ruler indicator will be created by updateNowIndicatorPosition
    updateAllNowIndicators();
    nowIndicatorInterval = setInterval(updateAllNowIndicators, 60000);
}

function updateNowIndicatorPosition(timeline) {
    const now = new Date();
    const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const nowTime = now.getTime();
    
    // Remove the old red dot indicator if it exists
    const oldIndicator = timeline.querySelector('.now-indicator');
    const oldLine = timeline.querySelector('.now-indicator-line');
    if (oldIndicator) oldIndicator.remove();
    if (oldLine) oldLine.remove();
    
    // Get the container and ruler
    const container = timeline.closest('.timeline-container');
    if (!container) return;
    
    const ruler = container.querySelector('.timeline-ruler');
    if (!ruler) return;
    
    // Get the active jobs (non-printed)
    const jobs = timeline.querySelectorAll('.job:not(.job-printed)');
    
    let positionPercentage = 5; // Default position
    
    if (jobs.length > 0) {
        const containerRect = container.getBoundingClientRect();
        const containerWidth = container.clientWidth || 800;
        const timelineScrollWidth = timeline.scrollWidth || timeline.offsetWidth || 800;
        const totalWidth = Math.max(timelineScrollWidth, containerWidth);
        
        let foundPosition = false;
        
        // Check each job to find where "now" falls
        for (const job of jobs) {
            const jobId = job.getAttribute('data-job-id');
            const scheduleData = jobSchedule[jobId];
            
            if (scheduleData) {
                const jobRect = job.getBoundingClientRect();
                const leftPx = jobRect.left - containerRect.left + container.scrollLeft + RULER_SHIFT_OFFSET;
                const rightPx = jobRect.right - containerRect.left + container.scrollLeft + RULER_SHIFT_OFFSET;
                const jobStart = scheduleData.startTime;
                const jobEnd = scheduleData.endTime;
                
                // Check if current time is inside this job
                if (nowTime >= jobStart && nowTime <= jobEnd) {
                    // Calculate position within the job based on time ratio
                    const jobDuration = jobEnd - jobStart;
                    const elapsed = nowTime - jobStart;
                    const jobProgress = elapsed / jobDuration;
                    const pos = leftPx + (jobProgress * (rightPx - leftPx));
                    positionPercentage = (pos / totalWidth) * 100;
                    foundPosition = true;
                    break;
                }
                // Check if current time is between jobs
                else if (jobEnd < nowTime) {
                    // Look at the next job
                    const nextJob = job.nextElementSibling;
                    if (nextJob && nextJob.classList.contains('job') && !nextJob.classList.contains('job-printed')) {
                        const nextJobId = nextJob.getAttribute('data-job-id');
                        const nextSchedule = jobSchedule[nextJobId];
                        if (nextSchedule && nowTime < nextSchedule.startTime) {
                            // Between jobs - position in the gap
                            const gapStart = jobEnd;
                            const gapEnd = nextSchedule.startTime;
                            const gapDuration = gapEnd - gapStart;
                            const gapElapsed = nowTime - gapStart;
                            const gapProgress = gapDuration > 0 ? gapElapsed / gapDuration : 0;
                            
                            const nextJobRect = nextJob.getBoundingClientRect();
                            const nextLeftPx = nextJobRect.left - containerRect.left + container.scrollLeft + RULER_SHIFT_OFFSET;
                            
                            const pos = rightPx + (gapProgress * (nextLeftPx - rightPx));
                            positionPercentage = (pos / totalWidth) * 100;
                            foundPosition = true;
                            break;
                        }
                    }
                }
            }
        }
        
        // If not found in any job or gap, check if before first or after last
        if (!foundPosition) {
            const firstJob = jobs[0];
            const firstJobId = firstJob.getAttribute('data-job-id');
            const lastJob = jobs[jobs.length - 1];
            const lastJobId = lastJob.getAttribute('data-job-id');
            
            if (jobSchedule[firstJobId] && nowTime < jobSchedule[firstJobId].startTime) {
                // Before first job
                positionPercentage = 2;
            } else if (jobSchedule[lastJobId] && nowTime > jobSchedule[lastJobId].endTime) {
                // After last job
                positionPercentage = 98;
            }
        }
    }
    
    // Clamp to visible range
    positionPercentage = Math.min(98, Math.max(2, positionPercentage));
    
    // Create or update the now marker on the ruler
    let nowMarker = ruler.querySelector('.ruler-now-marker');
    if (!nowMarker) {
        nowMarker = document.createElement('div');
        nowMarker.className = 'ruler-now-marker';
        ruler.appendChild(nowMarker);
    }
    
    // Style the now marker
    nowMarker.style.cssText = `
        position: absolute;
        top: 0;
        height: 100%;
        width: 2px;
        background: #e74c3c;
        transform: translateX(-50%);
        z-index: 6;
        left: ${positionPercentage}%;
    `;
    
    // Create or update the label with the current time
    let label = nowMarker.querySelector('.ruler-now-label');
    if (!label) {
        label = document.createElement('span');
        label.className = 'ruler-now-label';
        nowMarker.appendChild(label);
    }
    
    label.style.cssText = `
        position: absolute;
        top: -16px;
        left: 50%;
        transform: translateX(-50%);
        font-size: 8px;
        font-weight: 700;
        color: #e74c3c;
        background: white;
        padding: 0 8px;
        border-radius: 3px;
        white-space: nowrap;
        box-shadow: 0 1px 4px rgba(0,0,0,0.1);
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    `;
    label.textContent = `${timeString}`;
    
    // Also update the now indicator on the timeline (if it exists)
    const nowIndicator = timeline.querySelector('.now-indicator');
    const nowLine = timeline.querySelector('.now-indicator-line');
    if (nowIndicator) {
        nowIndicator.style.left = `${positionPercentage}%`;
        nowIndicator.setAttribute('data-time', timeString);
    }
    if (nowLine) {
        nowLine.style.left = `${positionPercentage}%`;
    }
}

function updateAllNowIndicators() {
    document.querySelectorAll('.timeline').forEach(timeline => {
        updateNowIndicatorPosition(timeline);
    });
}

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
    
    // INDEPENDENT ZOOM PER TIMELINE:
    // Scale based on the SMALLEST job duration
    // The smallest job gets a minimum width, others scale proportionally
    
    const MIN_JOB_WIDTH = 80;  // Increased from 60 to 120 for better visibility
    const MAX_JOB_WIDTH = 600;
    const MIN_DURATION_FOR_SCALING = 1; // 1 minute minimum
    
    // Ensure we have a valid min duration
    const effectiveMinDuration = Math.max(minDuration, MIN_DURATION_FOR_SCALING);
    
    // Calculate pixels per minute so the smallest job gets MIN_JOB_WIDTH
    let pixelsPerMinute = MIN_JOB_WIDTH / effectiveMinDuration;
    
    // Apply zoom
    pixelsPerMinute = pixelsPerMinute * currentZoomLevel;
    
    // Clamp to reasonable values
    pixelsPerMinute = Math.max(0.5, Math.min(20, pixelsPerMinute));
    
    // Style active jobs with proportional widths based on the smallest job
    jobDurations.forEach(({ job, duration }) => {
        let width = duration * pixelsPerMinute;
        // Ensure minimum width is large enough to show content
        width = Math.max(MIN_JOB_WIDTH * 0.8, Math.min(MAX_JOB_WIDTH * 1.2, width));
        applyJobStyle(job, width);
    });
    
    // Style printed jobs - fixed width, stacked to the left
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
    
    updateNowIndicatorPosition(timeline);
}

function applyJobStyle(job, jobWidth) {
    jobWidth = Math.round(jobWidth * 10) / 10;
    
    // Ensure minimum width for readability
    const minWidth = 100;
    const maxWidth = 600;
    jobWidth = Math.max(minWidth, Math.min(maxWidth, jobWidth));
    
    job.style.width = `${jobWidth}px`;
    job.style.flexShrink = '0';
    job.style.minWidth = `${minWidth}px`;
    job.style.maxWidth = `${maxWidth}px`;
    
    // Font sizes
    const fontSize = Math.max(9, Math.min(14, 11 * currentZoomLevel));
    
    // ✅ Job name - smaller font
    const nameFontSize = Math.max(9, Math.min(13, 10 * currentZoomLevel));
    
    // ✅ Job number badge - keep it larger (same as before)
    const badgeFontSize = Math.max(11, Math.min(16, 13 * currentZoomLevel));
    
    const jobName = job.querySelector('.job-name');
    if (jobName) {
        jobName.style.fontSize = `${nameFontSize}px`;
        
        // Update the job number badge inside the job name
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
    
    // Adjust padding
    const padding = Math.max(6, Math.min(12, 8 * currentZoomLevel));
    job.style.padding = `${padding}px ${padding * 1.2}px`;
}

// ============================================================
// TIMELINE SCHEDULING
// ============================================================

function rescheduleTimelineJobs(timelineId) {
    const timeline = document.getElementById(timelineId);
    if (!timeline) return;
    
    // Separate printed and active jobs
    const printedJobs = timeline.querySelectorAll('.job.job-printed');
    const activeJobs = timeline.querySelectorAll('.job:not(.job-printed)');
    
    // Printed jobs stay at the left with their existing schedule
    // Only reschedule active jobs
    
    if (activeJobs.length === 0) return;
    
    // Start time for active jobs: after the last printed job or current time
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
    
    // ✅ UPDATE MACHINE FIELD - Extract machine number from timeline ID
    const machineNumber = timelineId.replace('timeline-', '');
    jobData.machine = machineNumber;
    if (plDatabase[jobId]) {
        plDatabase[jobId].machine = machineNumber;
    }
    console.log(`✅ Machine field updated for job ${jobId} to: ${machineNumber}`);
    
    // Also update the modal's machine select if it's open
    const modal = document.getElementById('job-details-modal');
    if (modal && modal.classList.contains('active')) {
        const machineSelect = document.getElementById('modal-machine');
        if (machineSelect) {
            machineSelect.value = machineNumber;
        }
    }
    
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
    
    // Insert at exact position
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
// HANDLE FEED TO TIMELINE - in main.js
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
    
    // ✅ UPDATE MACHINE FIELD - Get machine number from timeline ID
    const machineNumber = timeline.id.replace('timeline-', '');
    if (jobDatabase[jobId]) {
        jobDatabase[jobId].machine = machineNumber;
    }
    if (plDatabase[jobId]) {
        plDatabase[jobId].machine = machineNumber;
    }
    console.log(`✅ Machine field updated for job ${jobId} to: ${machineNumber}`);
    
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
// HANDLE JOB REORDER - in main.js
// ============================================================

function handleJobReorder(jobId, targetTimeline, e) {
    const oldTimeline = draggedElement.parentElement;
    const afterElement = getDragAfterElement(targetTimeline, e.clientX);
    let insertBeforeElement = null;
    
    // Remove from old position
    draggedElement.remove();
    
    // ✅ UPDATE MACHINE FIELD - Get machine number from target timeline ID
    const machineNumber = targetTimeline.id.replace('timeline-', '');
    if (jobDatabase[jobId]) {
        jobDatabase[jobId].machine = machineNumber;
    }
    if (plDatabase[jobId]) {
        plDatabase[jobId].machine = machineNumber;
    }
    console.log(`✅ Machine field updated for job ${jobId} to: ${machineNumber}`);
    
    // Insert at new position
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
    
    // Update schedule
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
// RETURN JOB TO FEED - clears machine field
// ============================================================

function returnJobToFeed(jobElement) {
    const jobId = jobElement.getAttribute('data-job-id');
    const jobData = jobDatabase[jobId];
    if (!jobData) return;
    
    delete jobSpeeds[jobId];
    updateJobPLStatus(jobId, 'Unprinted');
    
    // ✅ CLEAR MACHINE FIELD when returning to feed
    jobData.machine = '';
    if (plDatabase[jobId]) {
        plDatabase[jobId].machine = '';
    }
    console.log(`✅ Machine field cleared for job ${jobId}`);
    
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
        // Re-sort jobs: printed jobs to the left
        sortPrintedJobs(timeline);
        scaleTimeline(timeline.id);
    });
}

// Sort printed jobs to the left of the timeline
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
    
    // Remove all jobs
    printedJobs.forEach(job => job.remove());
    activeJobs.forEach(job => job.remove());
    
    // Add printed jobs first (left side)
    printedJobs.forEach(job => timeline.appendChild(job));
    
    // Add active jobs after printed jobs
    activeJobs.forEach(job => timeline.appendChild(job));
}

// ============================================================
// TIMELINE SCROLLING WITH MOUSE
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
// DRAG AND DROP - Enhanced with auto-scroll and exact positioning
// ============================================================

function setupDragAndDrop() {
    console.log('Setting up drag and drop with enhanced features...');
    
    // Track auto-scroll during drag
    let dragScrollInterval = null;
    let dragScrollSpeed = 0;
    const SCROLL_SPEED = 15;
    const SCROLL_MARGIN = 80; // pixels from edge to trigger scroll
    
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
        // Stop auto-scroll
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
            
            // Auto-scroll logic
            const containerRect = container.getBoundingClientRect();
            const mouseX = e.clientX;
            const margin = SCROLL_MARGIN;
            
            if (mouseX < containerRect.left + margin) {
                // Scroll left
                if (!dragScrollInterval) {
                    dragScrollInterval = setInterval(() => {
                        container.scrollLeft -= SCROLL_SPEED;
                    }, 16);
                }
                dragScrollSpeed = -SCROLL_SPEED;
            } else if (mouseX > containerRect.right - margin) {
                // Scroll right
                if (!dragScrollInterval) {
                    dragScrollInterval = setInterval(() => {
                        container.scrollLeft += SCROLL_SPEED;
                    }, 16);
                }
                dragScrollSpeed = SCROLL_SPEED;
            } else {
                // Stop scrolling
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
    
    const jobs = timeline.querySelectorAll('.job:not(.job-printed)');
    let newStartTime;
    let insertBeforeElement = null;
    
    if (jobs.length > 0) {
        const afterElement = getDragAfterElement(timeline, e.clientX);
        if (afterElement) {
            // Insert before the afterElement
            insertBeforeElement = afterElement;
            const insertIndex = Array.from(timeline.children).indexOf(afterElement);
            const prevJob = insertIndex > 0 ? timeline.children[insertIndex - 1] : null;
            if (prevJob && prevJob.classList.contains('job') && !prevJob.classList.contains('job-printed')) {
                const prevJobId = prevJob.getAttribute('data-job-id');
                newStartTime = jobSchedule[prevJobId]?.endTime || new Date().getTime();
            } else {
                // Insert at beginning of active jobs
                const firstPrinted = timeline.querySelector('.job.job-printed');
                if (firstPrinted) {
                    // Insert right after printed jobs
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
            // Insert at the end
            const lastJobId = jobs[jobs.length - 1].getAttribute('data-job-id');
            newStartTime = jobSchedule[lastJobId]?.endTime || new Date().getTime();
        }
    } else {
        // No active jobs - check if there are printed jobs
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
    
    // Update machine field
    const machineNumber = timeline.id.replace('timeline-', '');
    if (jobDatabase[jobId]) {
        jobDatabase[jobId].machine = machineNumber;
    }
    if (plDatabase[jobId]) {
        plDatabase[jobId].machine = machineNumber;
    }
    
    const jobName = jobDatabase[jobId]?.name || jobId;
    showNotification(`✅ "${jobName}" added to Machine ${machineNumber} (PL: Planned)`, 'success');
    setTimeout(() => updateAllTimelineScrollPositions(), 300);
}

function handleJobReorder(jobId, targetTimeline, e) {
    const oldTimeline = draggedElement.parentElement;
    const afterElement = getDragAfterElement(targetTimeline, e.clientX);
    let insertBeforeElement = null;
    
    // Remove from old position
    draggedElement.remove();
    
    // Insert at new position
    if (afterElement) {
        insertBeforeElement = afterElement;
        targetTimeline.insertBefore(draggedElement, afterElement);
    } else {
        // Insert at end before printed jobs
        const firstPrinted = targetTimeline.querySelector('.job.job-printed');
        if (firstPrinted) {
            targetTimeline.insertBefore(draggedElement, firstPrinted);
        } else {
            targetTimeline.appendChild(draggedElement);
        }
    }
    
    // Update machine field
    const machineNumber = targetTimeline.id.replace('timeline-', '');
    if (jobDatabase[jobId]) {
        jobDatabase[jobId].machine = machineNumber;
    }
    if (plDatabase[jobId]) {
        plDatabase[jobId].machine = machineNumber;
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
        
        // Sort printed jobs to the left
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