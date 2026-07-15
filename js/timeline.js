// timeline.js - COMPLETE REWRITE
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
const nowIndicatorPositions = {};
const timelineStateCache = {};

// ============================================================
// TIMELINE RULER
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
    
    const totalWidth = Math.max(timeline.scrollWidth, timeline.offsetWidth, 800);
    const containerRect = container.getBoundingClientRect();
    const scrollLeft = container.scrollLeft || 0;
    
    // Get job positions
    let jobPositions = [];
    jobs.forEach(job => {
        const jobId = job.getAttribute('data-job-id');
        const scheduleData = jobSchedule[jobId];
        if (scheduleData) {
            const jobRect = job.getBoundingClientRect();
            const leftPx = jobRect.left - containerRect.left + scrollLeft;
            const rightPx = jobRect.right - containerRect.left + scrollLeft;
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
    
    // Check if state has changed
    const stateHash = jobPositions.map(p => 
        `${p.id}|${p.leftPx.toFixed(2)}|${p.rightPx.toFixed(2)}|${p.isPrinted}`
    ).join(';');
    
    const timelineId = timeline.id;
    if (timelineStateCache[timelineId] === stateHash) {
        return;
    }
    timelineStateCache[timelineId] = stateHash;
    
    // Date header
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
    
    // Ruler
    const ruler = document.createElement('div');
    ruler.className = 'timeline-ruler';
    ruler.style.width = totalWidth + 'px';
    
    // Add ticks for each job
    jobPositions.forEach((pos, index) => {
        const startPercent = Math.max(0, Math.min(100, (pos.leftPx / totalWidth) * 100));
        const endPercent = Math.max(0, Math.min(100, (pos.rightPx / totalWidth) * 100));
        
        const startDateObj = new Date(pos.startTime);
        const endDateObj = new Date(pos.endTime);
        
        const startTimeStr = startDateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const endTimeStr = endDateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const startDateStr = startDateObj.toLocaleDateString([], { month: 'short', day: 'numeric' });
        const endDateStr = endDateObj.toLocaleDateString([], { month: 'short', day: 'numeric' });
        
        const showStartDate = index === 0 || startDateObj.getDate() !== new Date(jobPositions[index - 1].startTime).getDate();
        const showEndDate = index === jobPositions.length - 1 || endDateObj.getDate() !== new Date(jobPositions[index + 1].startTime).getDate();
        
        // Start tick
        const startTick = document.createElement('div');
        startTick.className = 'ruler-tick start-tick';
        startTick.style.left = startPercent + '%';
        startTick.innerHTML = `
            <span class="tick-time start-time">▶ ${startTimeStr}</span>
            ${showStartDate ? `<span class="tick-date">${startDateStr}</span>` : ''}
        `;
        ruler.appendChild(startTick);
        
        // End tick
        const endTick = document.createElement('div');
        endTick.className = 'ruler-tick end-tick';
        endTick.style.left = endPercent + '%';
        endTick.innerHTML = `
            <span class="tick-time end-time">■ ${endTimeStr}</span>
            ${showEndDate ? `<span class="tick-date">${endDateStr}</span>` : ''}
        `;
        ruler.appendChild(endTick);
    });
    
    // Boundary lines
    for (let i = 1; i < jobPositions.length; i++) {
        const pos = jobPositions[i];
        const boundaryPercent = Math.max(0, Math.min(100, (pos.leftPx / totalWidth) * 100));
        const boundaryLine = document.createElement('div');
        boundaryLine.className = 'ruler-boundary-line';
        boundaryLine.style.left = boundaryPercent + '%';
        ruler.appendChild(boundaryLine);
    }
    
    container.prepend(ruler);
    container.prepend(dateHeader);
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
    if (!ruler) return;
    
    const jobs = timeline.querySelectorAll('.job:not(.job-printed)');
    
    // Get or create marker
    let marker = ruler.querySelector('.ruler-now-marker');
    if (!marker) {
        marker = document.createElement('div');
        marker.className = 'ruler-now-marker';
        ruler.appendChild(marker);
    }
    
    // Hide if no jobs
    if (jobs.length === 0) {
        marker.style.display = 'none';
        delete nowIndicatorPositions[timeline.id];
        return;
    }
    
    marker.style.display = 'block';
    
    const containerRect = container.getBoundingClientRect();
    const scrollLeft = container.scrollLeft || 0;
    const totalWidth = Math.max(ruler.offsetWidth, timeline.scrollWidth, 800);
    
    let positionPercentage = 2;
    let foundPosition = false;
    let currentJob = null;
    let currentJobProgress = 0;
    
    // Find current job
    for (let i = 0; i < jobs.length; i++) {
        const job = jobs[i];
        const jobId = job.getAttribute('data-job-id');
        const schedule = jobSchedule[jobId];
        if (!schedule) continue;
        
        const jobStart = schedule.startTime;
        const jobEnd = schedule.endTime;
        
        if (nowTime >= jobStart && nowTime <= jobEnd) {
            currentJob = job;
            const jobDuration = jobEnd - jobStart;
            const elapsed = nowTime - jobStart;
            currentJobProgress = jobDuration > 0 ? elapsed / jobDuration : 0;
            foundPosition = true;
            break;
        }
    }
    
    if (foundPosition && currentJob) {
        const jobRect = currentJob.getBoundingClientRect();
        const leftPx = jobRect.left - containerRect.left + scrollLeft;
        const rightPx = jobRect.right - containerRect.left + scrollLeft;
        const jobWidth = rightPx - leftPx;
        const posPx = leftPx + (currentJobProgress * jobWidth);
        positionPercentage = (posPx / totalWidth) * 100;
    } else {
        const firstJob = jobs[0];
        const lastJob = jobs[jobs.length - 1];
        const firstJobId = firstJob.getAttribute('data-job-id');
        const lastJobId = lastJob.getAttribute('data-job-id');
        
        if (!jobSchedule[firstJobId] || !jobSchedule[lastJobId]) {
            marker.style.display = 'none';
            return;
        }
        
        const firstStart = jobSchedule[firstJobId].startTime;
        const lastEnd = jobSchedule[lastJobId].endTime;
        
        const firstRect = firstJob.getBoundingClientRect();
        const lastRect = lastJob.getBoundingClientRect();
        
        const firstLeftPx = firstRect.left - containerRect.left + scrollLeft;
        const firstRightPx = firstRect.right - containerRect.left + scrollLeft;
        const lastRightPx = lastRect.right - containerRect.left + scrollLeft;
        
        if (nowTime < firstStart) {
            positionPercentage = (firstLeftPx / totalWidth) * 100;
        } else if (nowTime > lastEnd) {
            positionPercentage = (lastRightPx / totalWidth) * 100;
        } else {
            let gapFound = false;
            for (let i = 0; i < jobs.length - 1; i++) {
                const currentJobEl = jobs[i];
                const nextJobEl = jobs[i + 1];
                const currentId = currentJobEl.getAttribute('data-job-id');
                const nextId = nextJobEl.getAttribute('data-job-id');
                
                if (!jobSchedule[currentId] || !jobSchedule[nextId]) continue;
                
                const currentEnd = jobSchedule[currentId].endTime;
                const nextStart = jobSchedule[nextId].startTime;
                
                if (nowTime > currentEnd && nowTime < nextStart) {
                    const currentRect = currentJobEl.getBoundingClientRect();
                    const nextRect = nextJobEl.getBoundingClientRect();
                    
                    const currentRightPx = currentRect.right - containerRect.left + scrollLeft;
                    const nextLeftPx = nextRect.left - containerRect.left + scrollLeft;
                    
                    const gapStart = currentEnd;
                    const gapEnd = nextStart;
                    const gapDuration = gapEnd - gapStart;
                    const gapElapsed = nowTime - gapStart;
                    const gapProgress = gapDuration > 0 ? gapElapsed / gapDuration : 0;
                    
                    const posPx = currentRightPx + (gapProgress * (nextLeftPx - currentRightPx));
                    positionPercentage = (posPx / totalWidth) * 100;
                    gapFound = true;
                    break;
                }
            }
            
            if (!gapFound) {
                const totalDuration = lastEnd - firstStart;
                let progress = (nowTime - firstStart) / totalDuration;
                progress = Math.max(0, Math.min(1, progress));
                const posPx = firstLeftPx + (progress * (lastRightPx - firstLeftPx));
                positionPercentage = (posPx / totalWidth) * 100;
            }
        }
    }
    
    positionPercentage = Math.max(0.5, Math.min(99.5, positionPercentage));
    
    nowIndicatorPositions[timeline.id] = {
        position: positionPercentage,
        time: timeString,
        jobs: jobs.length,
        foundPosition: foundPosition,
        totalWidth: totalWidth,
        scrollLeft: scrollLeft
    };
    
    // Position marker
    marker.style.left = positionPercentage + '%';
    
    // Label
    let label = marker.querySelector('.ruler-now-label');
    if (!label) {
        label = document.createElement('span');
        label.className = 'ruler-now-label';
        marker.appendChild(label);
    }
    label.textContent = '🔴 ' + timeString;
}

// ============================================================
// INDICATOR MANAGEMENT
// ============================================================

function updateAllNowIndicators() {
    document.querySelectorAll('.timeline').forEach(timeline => {
        updateNowIndicatorPosition(timeline);
    });
}

function initializeNowIndicators() {
    if (nowIndicatorInterval) {
        clearInterval(nowIndicatorInterval);
        nowIndicatorInterval = null;
    }
    
    setTimeout(() => {
        updateAllNowIndicators();
    }, 500);
    
    nowIndicatorInterval = setInterval(updateAllNowIndicators, 5000);
}

function setupNowIndicatorPersistence() {
    if (nowIndicatorInterval) {
        clearInterval(nowIndicatorInterval);
    }
    
    nowIndicatorInterval = setInterval(updateAllNowIndicators, 5000);
    
    document.querySelectorAll('.timeline-container').forEach(container => {
        container.addEventListener('scroll', function() {
            clearTimeout(this._scrollTimeout);
            this._scrollTimeout = setTimeout(() => {
                const timeline = this.querySelector('.timeline');
                if (timeline) {
                    updateNowIndicatorPosition(timeline);
                }
            }, 50);
        }, { passive: true });
    });
    
    window.addEventListener('resize', function() {
        clearTimeout(this._resizeTimeout);
        this._resizeTimeout = setTimeout(updateAllNowIndicators, 100);
    });
}

function setupResizeObserver() {
    if (window.ResizeObserver) {
        const resizeObserver = new ResizeObserver(() => {
            updateAllNowIndicators();
        });
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
        if (job.classList.contains('job-printed')) {
            printedJobs.push(job);
        } else {
            activeJobs.push(job);
        }
    });
    
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
    
    if (activeJobs.length === 0) {
        printedJobs.forEach(job => {
            let width = 100 * currentZoomLevel;
            width = Math.max(80, Math.min(250, width));
            applyJobStyle(job, width);
        });
        delete timelineStateCache[timelineId];
        return;
    }
    
    const MIN_JOB_WIDTH = 80;
    const MAX_JOB_WIDTH = 600;
    const MIN_DURATION_FOR_SCALING = 1;
    
    const effectiveMinDuration = Math.max(minDuration, MIN_DURATION_FOR_SCALING);
    let pixelsPerMinute = MIN_JOB_WIDTH / effectiveMinDuration;
    pixelsPerMinute = pixelsPerMinute * currentZoomLevel;
    pixelsPerMinute = Math.max(0.5, Math.min(20, pixelsPerMinute));
    
    let widthsChanged = false;
    jobDurations.forEach(({ job, duration }) => {
        let width = duration * pixelsPerMinute;
        width = Math.max(MIN_JOB_WIDTH * 0.8, Math.min(MAX_JOB_WIDTH * 1.2, width));
        const currentWidth = parseFloat(job.style.width) || 0;
        if (Math.abs(currentWidth - width) > 5) {
            widthsChanged = true;
        }
        applyJobStyle(job, width);
    });
    
    printedJobs.forEach(job => {
        let width = 100 * currentZoomLevel;
        width = Math.max(80, Math.min(250, width));
        applyJobStyle(job, width);
    });
    
    if (widthsChanged) {
        delete timelineStateCache[timelineId];
    }
    
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
        const container = timeline.closest('.timeline-container');
        if (container) {
            const existingRuler = container.querySelector('.timeline-ruler');
            if (!existingRuler || widthsChanged) {
                if (existingRuler) existingRuler.remove();
                const existingHeader = container.querySelector('.timeline-date-header');
                if (existingHeader) existingHeader.remove();
                generateTimelineRuler(timeline);
            }
        }
    }
}

function applyJobStyle(job, jobWidth) {
    jobWidth = Math.round(jobWidth * 10) / 10;
    
    const minWidth = 100;
    const maxWidth = 600;
    jobWidth = Math.max(minWidth, Math.min(maxWidth, jobWidth));
    
    job.style.width = jobWidth + 'px';
    job.style.flexShrink = '0';
    job.style.minWidth = minWidth + 'px';
    job.style.maxWidth = maxWidth + 'px';
    
    const fontSize = Math.max(9, Math.min(14, 11 * currentZoomLevel));
    const nameFontSize = Math.max(9, Math.min(13, 10 * currentZoomLevel));
    const badgeFontSize = Math.max(11, Math.min(16, 13 * currentZoomLevel));
    
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
    
    const padding = Math.max(6, Math.min(12, 8 * currentZoomLevel));
    job.style.padding = padding + 'px ' + (padding * 1.2) + 'px';
}

// ============================================================
// TIMELINE SCHEDULING - PRESERVES EXISTING SCHEDULES
// ============================================================

function rescheduleTimelineJobs(timelineId, preserveExisting = true) {
    const timeline = document.getElementById(timelineId);
    if (!timeline) return;
    
    const printedJobs = timeline.querySelectorAll('.job.job-printed');
    const activeJobs = timeline.querySelectorAll('.job:not(.job-printed)');
    
    if (activeJobs.length === 0) return;
    
    let startTime = null;
    let startIndex = 0;
    
    if (preserveExisting) {
        const activeJobsArray = Array.from(activeJobs);
        
        // Find the first job without a schedule or with a broken schedule
        for (let i = 0; i < activeJobsArray.length; i++) {
            const job = activeJobsArray[i];
            const jobId = job.getAttribute('data-job-id');
            if (!jobSchedule[jobId] || jobSchedule[jobId].startTime === undefined) {
                startIndex = i;
                if (i > 0) {
                    const prevJob = activeJobsArray[i - 1];
                    const prevJobId = prevJob.getAttribute('data-job-id');
                    if (jobSchedule[prevJobId]) {
                        startTime = jobSchedule[prevJobId].endTime;
                    }
                }
                break;
            }
        }
        
        // If all jobs have schedules, verify consistency
        if (startTime === null) {
            let consistent = true;
            let expectedTime = null;
            
            for (let i = 0; i < activeJobsArray.length; i++) {
                const job = activeJobsArray[i];
                const jobId = job.getAttribute('data-job-id');
                const schedule = jobSchedule[jobId];
                
                if (!schedule) {
                    consistent = false;
                    startIndex = i;
                    if (i > 0) {
                        const prevJob = activeJobsArray[i - 1];
                        const prevJobId = prevJob.getAttribute('data-job-id');
                        if (jobSchedule[prevJobId]) {
                            startTime = jobSchedule[prevJobId].endTime;
                        }
                    }
                    break;
                }
                
                if (expectedTime === null) {
                    expectedTime = schedule.startTime;
                } else if (Math.abs(schedule.startTime - expectedTime) > 1000) {
                    consistent = false;
                    startIndex = i;
                    startTime = expectedTime;
                    break;
                }
                
                const duration = calculateJobDuration(jobDatabase[jobId], jobId) * 60000;
                expectedTime += duration;
            }
            
            if (consistent) {
                return;
            }
        }
    }
    
    if (startTime === null) {
        if (printedJobs.length > 0) {
            const lastPrinted = printedJobs[printedJobs.length - 1];
            const lastPrintedId = lastPrinted.getAttribute('data-job-id');
            if (jobSchedule[lastPrintedId]) {
                startTime = jobSchedule[lastPrintedId].endTime;
            } else {
                startTime = new Date().getTime();
            }
        } else {
            startTime = new Date().getTime();
        }
        startIndex = 0;
    }
    
    const activeJobsArray = Array.from(activeJobs);
    let currentTime = startTime;
    
    for (let i = startIndex; i < activeJobsArray.length; i++) {
        const job = activeJobsArray[i];
        const jobId = job.getAttribute('data-job-id');
        const jobData = jobDatabase[jobId];
        if (!jobData) continue;
        
        const duration = calculateJobDuration(jobData, jobId) * 60000;
        
        let jobStartTime = currentTime;
        if (preserveExisting && jobSchedule[jobId] && i === startIndex) {
            const originalStart = jobSchedule[jobId].startTime;
            if (originalStart >= currentTime) {
                jobStartTime = originalStart;
                currentTime = jobStartTime;
            }
        }
        
        jobSchedule[jobId] = {
            startTime: jobStartTime,
            endTime: jobStartTime + duration,
            timelineId: timelineId,
            isPrinted: false
        };
        
        currentTime = jobStartTime + duration;
    }
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
    
    let validInsertBefore = null;
    if (insertBeforeElement) {
        if (insertBeforeElement.parentElement === timeline) {
            validInsertBefore = insertBeforeElement;
        } else {
            const jobIdToInsertBefore = insertBeforeElement.getAttribute('data-job-id');
            if (jobIdToInsertBefore) {
                const foundElement = timeline.querySelector(`.job[data-job-id="${jobIdToInsertBefore}"]`);
                if (foundElement && foundElement.parentElement === timeline) {
                    validInsertBefore = foundElement;
                }
            }
        }
    }
    
    if (validInsertBefore) {
        timeline.insertBefore(jobElement, validInsertBefore);
    } else {
        const firstPrinted = timeline.querySelector('.job.job-printed');
        if (firstPrinted) {
            timeline.insertBefore(jobElement, firstPrinted);
        } else {
            timeline.appendChild(jobElement);
        }
    }
    
    delete timelineStateCache[timelineId];
    scaleTimeline(timelineId);
    updateMachineStatus(timeline.closest('.machine'));
    updateJobTimeDisplay(jobId);
    updateAllJobColors();
    updateStatistics();
    applySmartZoom();
    setTimeout(() => updateAllTimelineScrollPositions(), 300);
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
            if (afterElement.parentElement === timeline) {
                insertBeforeElement = afterElement;
            } else {
                const jobIdToInsertBefore = afterElement.getAttribute('data-job-id');
                if (jobIdToInsertBefore) {
                    const foundElement = timeline.querySelector(`.job[data-job-id="${jobIdToInsertBefore}"]`);
                    if (foundElement && foundElement.parentElement === timeline) {
                        insertBeforeElement = foundElement;
                    }
                }
            }
            
            if (insertBeforeElement) {
                const insertIndex = Array.from(timeline.children).indexOf(insertBeforeElement);
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
    rescheduleTimelineJobs(timeline.id, true);
    
    updateAllJobColors();
    updateStatistics();
    applySmartZoom();
    
    const jobName = jobDatabase[jobId]?.name || jobId;
    showNotification(`✅ "${jobName}" added to Machine ${machineNumber} (PL: Planned)`, 'success');
    setTimeout(() => updateAllTimelineScrollPositions(), 300);
}

function handleJobReorder(jobId, targetTimeline, e) {
    const oldTimeline = draggedElement.parentElement;
    const afterElement = getDragAfterElement(targetTimeline, e.clientX);
    let insertBeforeElement = null;
    
    if (afterElement && afterElement.parentElement === targetTimeline) {
        insertBeforeElement = afterElement;
    } else if (afterElement) {
        const jobIdToInsertBefore = afterElement.getAttribute('data-job-id');
        if (jobIdToInsertBefore) {
            const foundElement = targetTimeline.querySelector(`.job[data-job-id="${jobIdToInsertBefore}"]`);
            if (foundElement && foundElement.parentElement === targetTimeline) {
                insertBeforeElement = foundElement;
            }
        }
    }
    
    const jobScheduleData = jobSchedule[jobId];
    draggedElement.remove();
    
    const machineNumber = targetTimeline.id.replace('timeline-', '');
    if (jobDatabase[jobId]) {
        jobDatabase[jobId].machine = machineNumber;
    }
    if (plDatabase[jobId]) {
        plDatabase[jobId].machine = machineNumber;
    }
    
    if (insertBeforeElement && insertBeforeElement.parentElement === targetTimeline) {
        targetTimeline.insertBefore(draggedElement, insertBeforeElement);
    } else {
        const firstPrinted = targetTimeline.querySelector('.job.job-printed');
        if (firstPrinted) {
            targetTimeline.insertBefore(draggedElement, firstPrinted);
        } else {
            targetTimeline.appendChild(draggedElement);
        }
    }
    
    if (jobScheduleData) {
        jobScheduleData.timelineId = targetTimeline.id;
        jobSchedule[jobId] = jobScheduleData;
    }
    
    delete timelineStateCache[oldTimeline.id];
    delete timelineStateCache[targetTimeline.id];
    
    rescheduleTimelineJobs(oldTimeline.id, true);
    rescheduleTimelineJobs(targetTimeline.id, true);
    
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
        const timelineId = timeline.id;
        jobElement.remove();
        delete jobSchedule[jobId];
        delete timelineStateCache[timelineId];
        
        // Reschedule remaining jobs
        rescheduleTimelineJobs(timelineId, true);
        scaleTimeline(timelineId);
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
        delete timelineStateCache[timeline.id];
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

function clearTimelineCache(timelineId) {
    if (timelineId) {
        delete timelineStateCache[timelineId];
    } else {
        Object.keys(timelineStateCache).forEach(key => delete timelineStateCache[key]);
    }
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
// COMPLETED JOBS HANDLING
// ============================================================

function updateCompletedJobs() {
    const now = new Date().getTime();
    let hasChanges = false;
    
    document.querySelectorAll('.timeline').forEach(timeline => {
        const jobs = timeline.querySelectorAll('.job:not(.job-printed)');
        
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
                hasChanges = true;
            }
        });
        
        const printedJobs = timeline.querySelectorAll('.job.job-printed');
        if (printedJobs.length > 5) {
            const toRemove = Array.from(printedJobs).slice(5);
            toRemove.forEach(job => {
                const jobId = job.getAttribute('data-job-id');
                delete jobSchedule[jobId];
                job.remove();
                hasChanges = true;
            });
        }
        
        if (hasChanges) {
            sortPrintedJobs(timeline);
            delete timelineStateCache[timeline.id];
            const container = timeline.closest('.timeline-container');
            if (container) {
                container.querySelectorAll('.timeline-ruler, .timeline-date-header').forEach(el => el.remove());
                generateTimelineRuler(timeline);
            }
            updateMachineStatus(timeline.closest('.machine'));
        }
    });
    
    if (hasChanges) {
        updateStatistics();
        updateAllNowIndicators();
    }
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
        delete timelineStateCache[timeline.id];
        scaleTimeline(timeline.id);
    });
    updateAllNowIndicators();
    setTimeout(() => updateAllTimelineScrollPositions(), 200);
}

function updateZoomDisplay() {
    const zoomLevelDisplay = document.getElementById('zoom-level');
    if (zoomLevelDisplay) {
        zoomLevelDisplay.textContent = Math.round(currentZoomLevel * 100) + '%';
    }
}

function showZoomIndicator(message) {
    let indicator = document.querySelector('.zoom-indicator');
    if (!indicator) {
        indicator = document.createElement('div');
        indicator.className = 'zoom-indicator';
        document.querySelector('.machines-section').appendChild(indicator);
    }
    indicator.textContent = message + ': ' + Math.round(currentZoomLevel * 100) + '%';
    indicator.classList.add('visible');
    if (window.zoomIndicatorTimeout) {
        clearTimeout(window.zoomIndicatorTimeout);
    }
    window.zoomIndicatorTimeout = setTimeout(() => {
        indicator.classList.remove('visible');
    }, 2000);
}

// ============================================================
// DEBUG FUNCTIONS
// ============================================================

function debugNowIndicators() {
    console.log('=== Now Indicator Debug ===');
    for (const [timelineId, data] of Object.entries(nowIndicatorPositions)) {
        console.log(timelineId + ': ' + data.position.toFixed(2) + '% (' + data.time + ') - ' + data.jobs + ' jobs, found: ' + data.foundPosition);
    }
    console.log('============================');
}

function debugRulerAlignment(timelineId) {
    const timeline = document.getElementById(timelineId);
    if (!timeline) {
        console.log('Timeline ' + timelineId + ' not found');
        return;
    }
    
    const container = timeline.closest('.timeline-container');
    if (!container) {
        console.log('Container not found');
        return;
    }
    
    const ruler = container.querySelector('.timeline-ruler');
    if (!ruler) {
        console.log('Ruler not found');
        return;
    }
    
    const jobs = timeline.querySelectorAll('.job:not(.job-printed)');
    const containerRect = container.getBoundingClientRect();
    const scrollLeft = container.scrollLeft || 0;
    const totalWidth = Math.max(ruler.offsetWidth, timeline.scrollWidth, 800);
    
    console.log('=== ' + timelineId + ' Alignment Debug ===');
    console.log('totalWidth: ' + totalWidth);
    console.log('ruler width: ' + ruler.offsetWidth);
    console.log('timeline.scrollWidth: ' + timeline.scrollWidth);
    console.log('scrollLeft: ' + scrollLeft);
    console.log('jobs: ' + jobs.length);
    
    jobs.forEach((job, index) => {
        const jobRect = job.getBoundingClientRect();
        const leftPx = jobRect.left - containerRect.left + scrollLeft;
        const rightPx = jobRect.right - containerRect.left + scrollLeft;
        const leftPercent = (leftPx / totalWidth) * 100;
        const rightPercent = (rightPx / totalWidth) * 100;
        console.log('  Job ' + index + ': left=' + leftPercent.toFixed(2) + '%, right=' + rightPercent.toFixed(2) + '%');
    });
    
    const marker = ruler.querySelector('.ruler-now-marker');
    if (marker) {
        const markerLeft = parseFloat(marker.style.left);
        console.log('Marker position: ' + markerLeft + '%');
    }
    console.log('===============================');
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
window.setupNowIndicatorPersistence = setupNowIndicatorPersistence;
window.setupResizeObserver = setupResizeObserver;
window.debugNowIndicators = debugNowIndicators;
window.debugRulerAlignment = debugRulerAlignment;
window.nowIndicatorPositions = nowIndicatorPositions;
window.clearTimelineCache = clearTimelineCache;
window.timelineStateCache = timelineStateCache;

console.log('✅ timeline.js loaded - Complete rewrite with schedule preservation');
