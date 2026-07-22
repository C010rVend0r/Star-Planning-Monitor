// timeline.js - COMPLETE REWRITE WITH PROPER RULER MANAGEMENT
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
let rulerGenerationTimeout = null;
let isGeneratingRuler = false;
let scaleTimeout = null;
let pendingTimelineIds = new Set();
let isUpdatingCompletedJobs = false;

// ============================================================
// PRIORITY SORTING FUNCTION
// ============================================================
function sortTimelineJobsByPriority(timeline) {
    if (!timeline) return;
    
    const activeJobs = Array.from(timeline.querySelectorAll('.job:not(.job-printed)'));
    if (activeJobs.length <= 1) return;
    
    activeJobs.sort((a, b) => {
        const aId = a.getAttribute('data-job-id');
        const bId = b.getAttribute('data-job-id');
        
        const aData = jobDatabase[aId];
        const bData = jobDatabase[bId];
        
        const aPriority = aData?.priority !== undefined ? aData.priority : 999;
        const bPriority = bData?.priority !== undefined ? bData.priority : 999;
        
        if (aPriority !== bPriority) {
            return aPriority - bPriority;
        }
        
        const aJobNum = aData?.jobNumber || '';
        const bJobNum = bData?.jobNumber || '';
        return aJobNum.localeCompare(bJobNum);
    });
    
    const printedJobs = Array.from(timeline.querySelectorAll('.job.job-printed'));
    
    while (timeline.firstChild) {
        timeline.removeChild(timeline.firstChild);
    }
    
    printedJobs.forEach(job => timeline.appendChild(job));
    activeJobs.forEach(job => timeline.appendChild(job));
    
    console.log(`✅ Sorted ${timeline.id}: ${activeJobs.length} jobs by priority, ${printedJobs.length} printed at left`);
}

// ============================================================
// TIMELINE RULER
// ============================================================
function generateTimelineRuler(timeline) {
    if (isGeneratingRuler) {
        return;
    }
    isGeneratingRuler = true;
    
    try {
        const container = timeline.closest('.timeline-container');
        if (!container) {
            isGeneratingRuler = false;
            return;
        }
        
        const existingRuler = container.querySelector('.timeline-ruler');
        if (existingRuler) existingRuler.remove();
        const existingDateHeader = container.querySelector('.timeline-date-header');
        if (existingDateHeader) existingDateHeader.remove();
        
        const jobs = timeline.querySelectorAll('.job');
        if (jobs.length === 0) {
            isGeneratingRuler = false;
            return;
        }
        
        let totalWidth = 0;
        jobs.forEach(job => {
            totalWidth += job.offsetWidth + 6;
        });
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
        
        if (jobPositions.length === 0) {
            isGeneratingRuler = false;
            return;
        }
        
        const stateHash = jobPositions.map(p => 
            `${p.id}|${p.leftPx.toFixed(2)}|${p.rightPx.toFixed(2)}|${p.isPrinted}`
        ).join(';');
        
        const timelineId = timeline.id;
        if (timelineStateCache[timelineId] === stateHash) {
            const rulerCheck = container.querySelector('.timeline-ruler');
            if (rulerCheck) {
                isGeneratingRuler = false;
                return;
            }
            delete timelineStateCache[timelineId];
        }
        timelineStateCache[timelineId] = stateHash;
        
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
            const startDateStr = startDateObj.toLocaleDateString([], { month: 'short', day: 'numeric' });
            const endDateStr = endDateObj.toLocaleDateString([], { month: 'short', day: 'numeric' });
            
            const showStartDate = index === 0 || startDateObj.getDate() !== new Date(jobPositions[index - 1].startTime).getDate();
            const showEndDate = index === jobPositions.length - 1 || endDateObj.getDate() !== new Date(jobPositions[index + 1].startTime).getDate();
            
            const startTick = document.createElement('div');
            startTick.className = 'ruler-tick start-tick';
            startTick.style.left = Math.max(0, Math.min(100, startPercent)) + '%';
            startTick.innerHTML = `
                <span class="tick-time start-time">▶ ${startTimeStr}</span>
                ${showStartDate ? `<span class="tick-date">${startDateStr}</span>` : ''}
            `;
            ruler.appendChild(startTick);
            
            const endTick = document.createElement('div');
            endTick.className = 'ruler-tick end-tick';
            endTick.style.left = Math.max(0, Math.min(100, endPercent)) + '%';
            endTick.innerHTML = `
                <span class="tick-time end-time">■ ${endTimeStr}</span>
                ${showEndDate ? `<span class="tick-date">${endDateStr}</span>` : ''}
            `;
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
// NOW INDICATOR - WITH PERCENTAGE (ACCURATE POSITION)
// ============================================================
// ============================================================
// ============================================================
// NOW INDICATOR - WITH PERCENTAGE BASED ON CURRENT JOB PROGRESS
// ============================================================
function updateNowIndicatorPosition(timeline) {
    const now = new Date();
    const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const nowTime = now.getTime();
    
    const container = timeline.closest('.timeline-container');
    if (!container) return;
    
    // Get or create ruler
    let ruler = container.querySelector('.timeline-ruler');
    if (!ruler) {
        generateTimelineRuler(timeline);
        ruler = container.querySelector('.timeline-ruler');
        if (!ruler) return;
    }
    
    const jobs = timeline.querySelectorAll('.job:not(.job-printed)');
    
    // Get or create marker
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
    
    // Get dimensions
    const containerRect = container.getBoundingClientRect();
    const scrollLeft = container.scrollLeft || 0;
    const totalWidth = Math.max(ruler.scrollWidth, timeline.scrollWidth, container.scrollWidth, 800);
    
    let positionPercentage = 2;
    let foundPosition = false;
    let progressPercent = 0;
    let currentJobName = '';
    let jobProgress = 0;
    
    // Find which job the current time falls into
    for (let i = 0; i < jobs.length; i++) {
        const job = jobs[i];
        const jobId = job.getAttribute('data-job-id');
        const schedule = jobSchedule[jobId];
        if (!schedule) continue;
        
        const jobStart = schedule.startTime;
        const jobEnd = schedule.endTime;
        const jobData = jobDatabase[jobId];
        const jobName = jobData?.name || jobId;
        
        // If NOW is inside this job
        if (nowTime >= jobStart && nowTime <= jobEnd) {
            const jobRect = job.getBoundingClientRect();
            const jobLeft = jobRect.left - containerRect.left + scrollLeft;
            const jobWidth = jobRect.width;
            const jobDuration = jobEnd - jobStart;
            const elapsed = nowTime - jobStart;
            const progress = jobDuration > 0 ? elapsed / jobDuration : 0;
            
            // ⭐ Position on the ruler (visual position)
            const posPx = jobLeft + (progress * jobWidth);
            positionPercentage = (posPx / totalWidth) * 100;
            
            // ⭐ PROGRESS PERCENTAGE = progress through the current job (0-100%)
            progressPercent = Math.round(progress * 100);
            jobProgress = progress;
            currentJobName = jobName;
            foundPosition = true;
            break;
        }
    }
    
    // If NOW is not inside any job, find the gap or edge
    if (!foundPosition) {
        let foundGap = false;
        
        for (let i = 0; i < jobs.length - 1; i++) {
            const currentJob = jobs[i];
            const nextJob = jobs[i + 1];
            const currentId = currentJob.getAttribute('data-job-id');
            const nextId = nextJob.getAttribute('data-job-id');
            
            if (!jobSchedule[currentId] || !jobSchedule[nextId]) continue;
            
            const currentEnd = jobSchedule[currentId].endTime;
            const nextStart = jobSchedule[nextId].startTime;
            
            if (nowTime > currentEnd && nowTime < nextStart) {
                const currentRect = currentJob.getBoundingClientRect();
                const nextRect = nextJob.getBoundingClientRect();
                
                const currentRightPx = currentRect.right - containerRect.left + scrollLeft;
                const nextLeftPx = nextRect.left - containerRect.left + scrollLeft;
                
                const gapStart = currentEnd;
                const gapEnd = nextStart;
                const gapDuration = gapEnd - gapStart;
                const gapElapsed = nowTime - gapStart;
                const gapProgress = gapDuration > 0 ? gapElapsed / gapDuration : 0;
                
                const posPx = currentRightPx + (gapProgress * (nextLeftPx - currentRightPx));
                positionPercentage = (posPx / totalWidth) * 100;
                foundGap = true;
                // ⭐ In gap between jobs, show overall progress
                const firstId = jobs[0].getAttribute('data-job-id');
                const lastId = jobs[jobs.length - 1].getAttribute('data-job-id');
                if (jobSchedule[firstId] && jobSchedule[lastId]) {
                    const firstStart = jobSchedule[firstId].startTime;
                    const lastEnd = jobSchedule[lastId].endTime;
                    const totalDuration = lastEnd - firstStart;
                    if (totalDuration > 0) {
                        const overallProgress = ((nowTime - firstStart) / totalDuration) * 100;
                        progressPercent = Math.round(overallProgress);
                    }
                }
                break;
            }
        }
        
        if (!foundGap && jobs.length > 0) {
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
    }
    
    // Clamp position
    positionPercentage = Math.max(0.5, Math.min(99.5, positionPercentage));
    progressPercent = Math.max(0, Math.min(100, progressPercent));
    
    // Store position data
    nowIndicatorPositions[timeline.id] = {
        position: positionPercentage,
        time: timeString,
        progress: progressPercent,
        foundPosition: foundPosition,
        jobName: currentJobName,
        jobProgress: jobProgress,
        totalWidth: totalWidth,
        scrollLeft: scrollLeft,
        timestamp: now.getTime()
    };
    
    // Update marker position on the ruler
    marker.style.left = positionPercentage + '%';
    marker.style.transition = 'left 0.5s ease';
    
    // Update label with percentage
    let label = marker.querySelector('.ruler-now-label');
    if (!label) {
        label = document.createElement('span');
        label.className = 'ruler-now-label';
        marker.appendChild(label);
    }
    
    // ⭐ Show progress percentage (based on current job or overall)
    label.textContent = `🔴 NOW ${timeString}  (${progressPercent}%)`;
    
    // Color coding based on progress
    if (progressPercent < 25) {
        label.style.color = '#28a745';
        label.style.borderColor = 'rgba(40, 167, 69, 0.4)';
        label.style.animation = 'none';
    } else if (progressPercent < 50) {
        label.style.color = '#17a2b8';
        label.style.borderColor = 'rgba(23, 162, 184, 0.4)';
        label.style.animation = 'none';
    } else if (progressPercent < 75) {
        label.style.color = '#fd7e14';
        label.style.borderColor = 'rgba(253, 126, 20, 0.4)';
        label.style.animation = 'none';
    } else {
        label.style.color = '#dc3545';
        label.style.borderColor = 'rgba(220, 53, 69, 0.4)';
        label.style.animation = 'pulse-percentage 1s ease-in-out infinite';
    }
    
    // Auto-scroll to show NOW indicator if enabled
    if (autoScrollEnabled) {
        const containerWidth = container.clientWidth;
        const markerPosition = (positionPercentage / 100) * totalWidth;
        const targetScroll = markerPosition - (containerWidth / 3);
        
        const currentScroll = container.scrollLeft;
        const markerVisibleLeft = markerPosition - currentScroll;
        const markerVisibleRight = markerPosition - (currentScroll + containerWidth);
        
        if (markerVisibleLeft < 20 || markerVisibleRight > -20) {
            container.scrollTo({
                left: Math.max(0, targetScroll),
                behavior: 'smooth'
            });
        }
    }
}
// ============================================================
// UPDATE ALL NOW INDICATORS
// ============================================================
function updateAllNowIndicators() {
    document.querySelectorAll('.timeline').forEach(timeline => {
        updateNowIndicatorPosition(timeline);
    });
}

// ============================================================
// INDICATOR MANAGEMENT
// ============================================================
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
        pixelsPerMinute = baseWidth / totalDuration;
        pixelsPerMinute = pixelsPerMinute * currentZoomLevel;
        pixelsPerMinute = Math.max(0.8, Math.min(20, pixelsPerMinute));
    } else {
        pixelsPerMinute = 2 * currentZoomLevel;
    }
    
    let widthsChanged = false;
    jobDurations.forEach(({ job, duration }) => {
        let width = duration * pixelsPerMinute;
        width = Math.max(MIN_JOB_WIDTH, Math.min(MAX_JOB_WIDTH, width));
        
        const currentWidth = parseFloat(job.style.width) || 0;
        if (Math.abs(currentWidth - width) > 2) {
            widthsChanged = true;
        }
        applyJobStyle(job, width);
    });
    
    printedJobs.forEach(job => {
        let width = 120 * currentZoomLevel;
        width = Math.max(80, Math.min(250, width));
        applyJobStyle(job, width);
    });
    
    const containerExists = container && container.querySelector('.timeline-ruler');
    if (widthsChanged || !containerExists) {
        delete timelineStateCache[timelineId];
        
        if (container) {
            container.querySelectorAll('.timeline-ruler, .timeline-date-header').forEach(el => el.remove());
            generateTimelineRuler(timeline);
        }
    }
}

function debouncedScaleTimeline(timelineId, delay = 300) {
    if (!timelineId) return;
    
    pendingTimelineIds.add(timelineId);
    
    if (scaleTimeout) {
        clearTimeout(scaleTimeout);
    }
    
    scaleTimeout = setTimeout(() => {
        const ids = Array.from(pendingTimelineIds);
        pendingTimelineIds.clear();
        
        ids.forEach(id => {
            try {
                delete timelineStateCache[id];
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
// TIMELINE SCHEDULING
// ============================================================
function rescheduleTimelineJobs(timelineId, preserveExisting = true) {
    const timeline = document.getElementById(timelineId);
    if (!timeline) return;
    
    if (timeline._rescheduling) {
        return;
    }
    timeline._rescheduling = true;
    
    try {
        const activeJobsArray = Array.from(timeline.querySelectorAll('.job:not(.job-printed)'));
        const printedJobs = timeline.querySelectorAll('.job.job-printed');
        
        if (activeJobsArray.length === 0) {
            timeline._rescheduling = false;
            return;
        }
        
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
        
        if (baseStartTime === null) {
            baseStartTime = new Date().getTime();
        }
        
        let currentTime = baseStartTime;
        
        for (let i = 0; i < activeJobsArray.length; i++) {
            const job = activeJobsArray[i];
            const jobId = job.getAttribute('data-job-id');
            const jobData = jobDatabase[jobId];
            if (!jobData) continue;
            
            const duration = calculateJobDuration(jobData, jobId) * 60000;
            
            if (i === 0) {
                if (preserveExisting && jobSchedule[jobId] && jobSchedule[jobId].startTime !== undefined) {
                    const existingStart = jobSchedule[jobId].startTime;
                    if (Math.abs(existingStart - baseStartTime) < 3600000) {
                        currentTime = existingStart;
                    } else {
                        currentTime = baseStartTime;
                    }
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
        while (timeline.firstChild) {
            timeline.removeChild(timeline.firstChild);
        }
        printed.forEach(job => timeline.appendChild(job));
        activeJobs.forEach(job => timeline.appendChild(job));
    }
    
    delete timelineStateCache[timelineId];
    debouncedScaleTimeline(timelineId);
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
    
    const jobData = jobDatabase[jobId];
    const newPriority = jobData?.priority !== undefined ? jobData.priority : 999;
    
    const activeJobs = Array.from(timeline.querySelectorAll('.job:not(.job-printed)'));
    let insertBeforeElement = null;
    let newStartTime;
    
    if (activeJobs.length > 0) {
        let insertIndex = activeJobs.length;
        for (let i = 0; i < activeJobs.length; i++) {
            const existingJob = activeJobs[i];
            const existingId = existingJob.getAttribute('data-job-id');
            const existingPriority = jobDatabase[existingId]?.priority !== undefined ? 
                jobDatabase[existingId].priority : 999;
            
            if (newPriority < existingPriority) {
                insertBeforeElement = existingJob;
                insertIndex = i;
                break;
            }
        }
        
        if (insertBeforeElement) {
            const insertIndex = Array.from(timeline.children).indexOf(insertBeforeElement);
            const prevJob = insertIndex > 0 ? timeline.children[insertIndex - 1] : null;
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
    rescheduleTimelineJobs(timeline.id, true);
    
    updateAllJobColors();
    updateStatistics();
    applySmartZoom();
    
    const jobName = jobDatabase[jobId]?.name || jobId;
    showNotification(`✅ "${jobName}" added to Machine ${machineNumber} (Priority: ${newPriority})`, 'success');
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
    
    sortTimelineJobsByPriority(targetTimeline);
    
    if (jobScheduleData) {
        jobScheduleData.timelineId = targetTimeline.id;
        jobSchedule[jobId] = jobScheduleData;
    }
    
    delete timelineStateCache[oldTimeline.id];
    delete timelineStateCache[targetTimeline.id];
    
    rescheduleTimelineJobs(oldTimeline.id, true);
    rescheduleTimelineJobs(targetTimeline.id, true);
    
    debouncedScaleTimeline(oldTimeline.id);
    debouncedScaleTimeline(targetTimeline.id);
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
        delete timelineStateCache[timelineId];
        
        rescheduleTimelineJobs(timelineId, true);
        debouncedScaleTimeline(timelineId);
        updateMachineStatus(timeline.closest('.machine'));
        applyFilter();
        updateStatistics();
        applySmartZoom();
        
        showNotification(`↩️ "${jobData.name || jobId}" returned to feed (PL: Unplanned)`, 'info');
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
            while (timeline.firstChild) {
                timeline.removeChild(timeline.firstChild);
            }
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
    
    console.log('✅ All timelines refreshed and rulers regenerated');
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
                sortTimelineJobsByPriority(this);
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
// COMPLETED JOBS HANDLING (SINGLE VERSION)
// ============================================================
function updateCompletedJobs() {
    if (isUpdatingCompletedJobs) {
        console.log('⏳ updateCompletedJobs already running, skipping...');
        return;
    }
    
    isUpdatingCompletedJobs = true;
    
    try {
        const now = new Date().getTime();
        let hasChanges = false;
        let completedJobIds = [];
        
        console.log(`🔍 Checking for completed jobs at ${new Date(now).toLocaleTimeString()}`);
        
        document.querySelectorAll('.timeline').forEach(timeline => {
            const jobs = timeline.querySelectorAll('.job:not(.job-printed)');
            console.log(`📊 ${timeline.id}: ${jobs.length} active jobs`);
            
            jobs.forEach(job => {
                const jobId = job.getAttribute('data-job-id');
                
                if (!jobSchedule[jobId]) {
                    console.log(`⚠️ Job ${jobId} has no schedule`);
                    return;
                }
                
                const endTime = jobSchedule[jobId].endTime;
                const isPrinted = jobSchedule[jobId].isPrinted;
                
                console.log(`📊 Job ${jobId}: endTime=${new Date(endTime).toLocaleTimeString()}, now=${new Date(now).toLocaleTimeString()}, isPrinted=${isPrinted}`);
                
                if (endTime <= now && !isPrinted) {
                    console.log(`✅ JOB ${jobId} IS COMPLETED! Marking as printed...`);
                    
                    job.classList.add('job-printed');
                    jobSchedule[jobId].isPrinted = true;
                    job.setAttribute('draggable', 'false');
                    
                    if (jobDatabase[jobId]) {
                        jobDatabase[jobId].status = 'Complete';
                        jobDatabase[jobId].planningStatus = 'Complete';
                        jobDatabase[jobId].isComplete = true;
                        jobDatabase[jobId].statusDate = new Date().toISOString();
                        console.log(`✅ Updated jobDatabase[${jobId}] to Complete`);
                    }
                    
                    if (plDatabase[jobId]) {
                        plDatabase[jobId].planningStatus = 'Complete';
                        plDatabase[jobId].isComplete = true;
                        plDatabase[jobId].statusDate = new Date().toISOString();
                        console.log(`✅ Updated plDatabase[${jobId}] to Complete`);
                    }
                    
                    const statusBadge = job.querySelector('.job-status-badge');
                    if (statusBadge) {
                        statusBadge.textContent = 'AW: Complete since: ' + formatDateOnly(new Date());
                        statusBadge.style.color = '#95a5a6';
                    }
                    
                    const priorityBadge = job.querySelector('.job-priority-badge');
                    if (priorityBadge) priorityBadge.remove();
                    
                    const plannedBadge = job.querySelector('.job-planned-badge');
                    if (plannedBadge) plannedBadge.remove();
                    
                    const jobName = job.querySelector('.job-name');
                    if (jobName && !jobName.querySelector('.job-complete-badge')) {
                        const completeBadge = document.createElement('span');
                        completeBadge.className = 'job-complete-badge';
                        completeBadge.style.cssText = 'background-color:#6c757d20; color:#6c757d; border:1px solid #6c757d40; font-size:8px; font-weight:700; padding:1px 5px; border-radius:3px; margin-left:4px; white-space:nowrap; display:inline-block;';
                        completeBadge.textContent = '✅ Complete';
                        jobName.appendChild(completeBadge);
                    }
                    
                    const inputs = job.querySelectorAll('.job-editable-fields input');
                    inputs.forEach(input => {
                        input.disabled = true;
                        input.style.backgroundColor = '#e9ecef';
                        input.style.cursor = 'not-allowed';
                        input.style.opacity = '0.7';
                    });
                    
                    completedJobIds.push(jobId);
                    hasChanges = true;
                    
                    const feedItem = document.querySelector(`.feed-job[data-job-id="${jobId}"]`);
                    if (feedItem) {
                        const jobData = jobDatabase[jobId];
                        if (jobData) {
                            const newFeedItem = createFeedJobElement(jobId, jobData);
                            feedItem.parentNode.replaceChild(newFeedItem, feedItem);
                        }
                    }
                    
                    // SAVE TO SUPABASE IMMEDIATELY
                    (async function saveCompletedJob() {
                        try {
                            if (jobDatabase[jobId]) {
                                const jobDataToSave = convertCamelToSnake(jobDatabase[jobId]);
                                jobDataToSave.job_id = jobId;
                                await supabaseSaveJob(jobId, jobDataToSave);
                                console.log(`✅ Completed job ${jobId} saved to Supabase`);
                            }
                            if (jobSchedule[jobId]) {
                                const scheduleData = {
                                    start_time: new Date(jobSchedule[jobId].startTime).toISOString(),
                                    end_time: new Date(jobSchedule[jobId].endTime).toISOString(),
                                    timeline_id: jobSchedule[jobId].timelineId,
                                    is_printed: true
                                };
                                await supabaseSaveSchedule(jobId, scheduleData);
                                console.log(`✅ Schedule for ${jobId} saved to Supabase`);
                            }
                        } catch (error) {
                            console.error('❌ Error saving completed job:', error);
                        }
                    })();
                }
            });
            
            const allPrintedJobs = Array.from(timeline.querySelectorAll('.job.job-printed'));
            
            if (allPrintedJobs.length > 1) {
                const printedWithTimes = allPrintedJobs.map(job => {
                    const id = job.getAttribute('data-job-id');
                    const endTime = jobSchedule[id]?.endTime || 0;
                    return { job, jobId: id, endTime };
                });
                
                printedWithTimes.sort((a, b) => b.endTime - a.endTime);
                const toRemove = printedWithTimes.slice(1);
                
                toRemove.forEach(({ job, jobId }) => {
                    delete jobSchedule[jobId];
                    job.remove();
                    hasChanges = true;
                    console.log(`🗑️ Removed old printed job ${jobId} from ${timeline.id}`);
                });
                
                if (toRemove.length > 0) {
                    console.log(`🗑️ Removed ${toRemove.length} old printed jobs from ${timeline.id}, kept 1 most recent`);
                }
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
            console.log(`🔄 Processing ${completedJobIds.length} completed jobs...`);
            
            const timelineIds = new Set();
            document.querySelectorAll('.timeline').forEach(timeline => {
                if (timeline.querySelectorAll('.job').length > 0) {
                    timelineIds.add(timeline.id);
                }
            });
            
            if (scaleTimeout) {
                clearTimeout(scaleTimeout);
                scaleTimeout = null;
            }
            
            scaleTimeout = setTimeout(() => {
                timelineIds.forEach(id => {
                    try {
                        delete timelineStateCache[id];
                        scaleTimeline(id);
                    } catch (e) {
                        console.warn('Error scaling timeline:', id, e);
                    }
                });
                timelineIds.clear();
                scaleTimeout = null;
            }, 500);
            
            setTimeout(() => {
                document.querySelectorAll('.timeline').forEach(timeline => {
                    const container = timeline.closest('.timeline-container');
                    if (container) {
                        container.querySelectorAll('.timeline-ruler, .timeline-date-header').forEach(el => el.remove());
                        generateTimelineRuler(timeline);
                    }
                    updateNowIndicatorPosition(timeline);
                });
            }, 1000);
            
            if (typeof scheduleAutoSave === 'function') {
                scheduleAutoSave();
            }
            
            updateStatistics();
            updateAllNowIndicators();
            updateFilterCounts();
            updateFilterBadge();
            updateAllJobColors();
            updateAllJobTimes();
            applySmartZoom();
            
            if (completedJobIds.length > 0) {
                const jobNames = completedJobIds.map(id => {
                    const jobData = jobDatabase[id];
                    return jobData ? jobData.name || id : id;
                });
                
                if (completedJobIds.length === 1) {
                    showNotification(`✅ "${jobNames[0]}" completed!`, 'success');
                } else {
                    showNotification(`✅ ${completedJobIds.length} jobs completed!`, 'success');
                }
            }
            
            console.log(`✅ ${completedJobIds.length} jobs completed and saved`);
        } else {
            console.log('✅ No jobs to complete at this time');
        }
        
    } catch (error) {
        console.error('❌ Error in updateCompletedJobs:', error);
    } finally {
        setTimeout(() => {
            isUpdatingCompletedJobs = false;
        }, 100);
    }
}

// ============================================================
// FORCE COMPLETION CHECK - Manual trigger
// ============================================================
function forceCompleteCheck() {
    console.log('🔄 FORCE COMPLETION CHECK TRIGGERED');
    updateCompletedJobs();
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
    if (!timeline) {
        showNotification(`⚠️ Job not found on timeline`, 'warning');
        return;
    }
    
    const machine = timeline.closest('.machine');
    if (!machine) {
        showNotification(`⚠️ Machine not found`, 'warning');
        return;
    }
    
    const machineId = machine.getAttribute('data-machine') || timeline.id.replace('timeline-', '');
    
    const machinesContainer = document.getElementById('machines-scroll-container');
    if (!machinesContainer) {
        showNotification(`⚠️ Machines container not found`, 'warning');
        return;
    }
    
    const machineElement = machinesContainer.querySelector(`.machine[data-machine="${machineId}"]`);
    if (!machineElement) {
        const altMachine = machinesContainer.querySelector(`#${timeline.id}`)?.closest('.machine');
        if (!altMachine) {
            showNotification(`⚠️ Machine ${machineId} not found`, 'warning');
            return;
        }
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
        const scrollTarget = machineElement.offsetLeft - 20;
        machinesContainer.scrollTo({
            left: scrollTarget,
            behavior: 'smooth'
        });
        highlightJobAndMachine(jobElement, machineElement);
        return;
    }
    
    const jobRect = jobElement.getBoundingClientRect();
    const containerRect = timelineContainer.getBoundingClientRect();
    const machineScrollTarget = machineElement.offsetLeft - 20;
    
    machinesContainer.scrollTo({
        left: machineScrollTarget,
        behavior: 'smooth'
    });
    
    setTimeout(() => {
        const updatedJobRect = jobElement.getBoundingClientRect();
        const updatedContainerRect = timelineContainer.getBoundingClientRect();
        
        const jobCenter = updatedJobRect.left + (updatedJobRect.width / 2);
        const containerCenter = updatedContainerRect.left + (updatedContainerRect.width / 2);
        const scrollOffset = jobCenter - containerCenter;
        
        const currentScroll = timelineContainer.scrollLeft;
        const newScroll = currentScroll + scrollOffset;
        
        timelineContainer.scrollTo({
            left: newScroll - (updatedJobRect.width / 2),
            behavior: 'smooth'
        });
    }, 350);
    
    setTimeout(() => {
        highlightJobAndMachine(jobElement, machineElement);
    }, 700);
}

function highlightJobAndMachine(jobElement, machineElement) {
    jobElement.classList.add('job-highlighted');
    
    if (window.jobHighlightTimeout) {
        clearTimeout(window.jobHighlightTimeout);
    }
    window.jobHighlightTimeout = setTimeout(() => {
        jobElement.classList.remove('job-highlighted');
    }, 5000);
    
    machineElement.classList.add('machine-highlighted');
    setTimeout(() => {
        machineElement.classList.remove('machine-highlighted');
    }, 5000);
    
    const jobName = jobDatabase[jobElement.getAttribute('data-job-id')]?.name || 'Job';
    const machineId = machineElement.getAttribute('data-machine') || 'Unknown';
    const priority = jobDatabase[jobElement.getAttribute('data-job-id')]?.priority || 'N/A';
    showNotification(`🔍 "${jobName}" on Machine ${machineId} (Priority: ${priority})`, 'info');
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
    showZoomIndicator('Reset Zoom');
    setTimeout(() => updateAllTimelineScrollPositions(), 200);
}

let zoomTimeout = null;

function applySmartZoom() {
    if (zoomTimeout) {
        clearTimeout(zoomTimeout);
    }
    
    zoomTimeout = setTimeout(() => {
        document.querySelectorAll('.timeline').forEach(timeline => {
            const container = timeline.closest('.timeline-container');
            if (container) {
                const ruler = container.querySelector('.timeline-ruler');
                if (ruler) {
                    ruler.remove();
                }
                const header = container.querySelector('.timeline-date-header');
                if (header) {
                    header.remove();
                }
            }
            delete timelineStateCache[timeline.id];
            debouncedScaleTimeline(timeline.id);
        });
        updateAllNowIndicators();
        setTimeout(() => updateAllTimelineScrollPositions(), 200);
        zoomTimeout = null;
    }, 100);
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
// ENSURE RULERS EXIST
// ============================================================
function ensureRulersExist() {
    document.querySelectorAll('.timeline').forEach(timeline => {
        const container = timeline.closest('.timeline-container');
        if (container) {
            const ruler = container.querySelector('.timeline-ruler');
            if (!ruler) {
                generateTimelineRuler(timeline);
            }
            
            const nowMarker = container.querySelector('.ruler-now-marker');
            if (!nowMarker) {
                updateNowIndicatorPosition(timeline);
            }
        }
    });
}

function startDynamicTimeUpdates() {
    console.log('🔄 Starting dynamic time updates with aggressive intervals...');
    
    setInterval(() => {
        updateAllJobTimes();
        updateAllMachineStatuses();
        updateAllJobColors();
        updateAllTimelineScrollPositions();
        ensureRulersExist();
    }, 5000);
    
    setInterval(() => {
        updateCompletedJobs();
    }, 10000);
    
    setInterval(() => {
        updateAllNowIndicators();
    }, 1000);
    
    console.log('✅ Dynamic time updates started (5s UI, 10s completion, 1s NOW indicator)');
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
        const jobId = job.getAttribute('data-job-id');
        const priority = jobDatabase[jobId]?.priority || 'N/A';
        console.log(`  Job ${index} (Priority: ${priority}): left=${leftPercent.toFixed(2)}%, right=${rightPercent.toFixed(2)}%`);
    });
    
    const marker = ruler.querySelector('.ruler-now-marker');
    if (marker) {
        const markerLeft = parseFloat(marker.style.left);
        console.log('Marker position: ' + markerLeft + '%');
    }
    console.log('===============================');
}

// ============================================================
// DEBUG JOB SCHEDULES
// ============================================================
function debugJobSchedules() {
    console.log('=== JOB SCHEDULE DEBUG ===');
    const now = new Date().getTime();
    
    for (const [jobId, schedule] of Object.entries(jobSchedule)) {
        const start = new Date(schedule.startTime);
        const end = new Date(schedule.endTime);
        const isComplete = schedule.isPrinted || false;
        const isPast = schedule.endTime <= now;
        const jobData = jobDatabase[jobId];
        const status = jobData?.planningStatus || 'Unknown';
        
        console.log(`${jobId}:`);
        console.log(`  Start: ${start.toLocaleString()}`);
        console.log(`  End:   ${end.toLocaleString()}`);
        console.log(`  Is Past: ${isPast}`);
        console.log(`  Is Printed: ${isComplete}`);
        console.log(`  Status: ${status}`);
        console.log(`  Should Complete: ${isPast && !isComplete ? '🔴 YES!' : 'OK'}`);
        console.log('---');
    }
    console.log('=========================');
}

// ============================================================
// DEBUG PERCENTAGE ACCURACY
// ============================================================
function debugPercentageAccuracy(timelineId) {
    const timeline = document.getElementById(timelineId);
    if (!timeline) {
        console.log(`❌ Timeline ${timelineId} not found`);
        return;
    }
    
    const container = timeline.closest('.timeline-container');
    if (!container) {
        console.log(`❌ Container not found`);
        return;
    }
    
    const ruler = container.querySelector('.timeline-ruler');
    if (!ruler) {
        console.log(`❌ Ruler not found`);
        return;
    }
    
    const marker = ruler.querySelector('.ruler-now-marker');
    if (!marker) {
        console.log(`❌ Marker not found`);
        return;
    }
    
    const posData = nowIndicatorPositions[timelineId];
    const markerLeft = parseFloat(marker.style.left) || 0;
    const rulerWidth = ruler.scrollWidth || ruler.offsetWidth;
    const containerWidth = container.clientWidth;
    const scrollLeft = container.scrollLeft || 0;
    
    console.log(`=== PERCENTAGE ACCURACY DEBUG for ${timelineId} ===`);
    console.log(`Marker CSS left: ${markerLeft}%`);
    console.log(`Stored position: ${posData?.position || 'N/A'}%`);
    console.log(`Stored progress: ${posData?.progress || 'N/A'}%`);
    console.log(`Ruler width: ${rulerWidth}px`);
    console.log(`Container width: ${containerWidth}px`);
    console.log(`Scroll left: ${scrollLeft}px`);
    console.log(`Should match: ${markerLeft}% ≈ ${posData?.position || 'N/A'}%`);
    console.log('===============================================');
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
window.debugNowIndicators = debugNowIndicators;
window.debugRulerAlignment = debugRulerAlignment;
window.debugJobSchedules = debugJobSchedules;
window.debugPercentageAccuracy = debugPercentageAccuracy;
window.nowIndicatorPositions = nowIndicatorPositions;
window.clearTimelineCache = clearTimelineCache;
window.timelineStateCache = timelineStateCache;
window.showJobOnTimeline = showJobOnTimeline;
window.scrollToMachine = scrollToMachine;
window.highlightJobAndMachine = highlightJobAndMachine;
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
window.checkJobOnTimeline = checkJobOnTimeline;
window.getDragAfterElement = getDragAfterElement;
window.forceCompleteCheck = forceCompleteCheck;
window.updateCompletedJobs = updateCompletedJobs;

console.log('✅ timeline.js loaded - Forced completion check available. Run forceCompleteCheck() in console.');
