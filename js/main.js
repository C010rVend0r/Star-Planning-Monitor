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
    
    // ⭐ CREATE FILTER PANEL ON PAGE LOAD (but keep it hidden)
    // This ensures the filter checkboxes exist when we need to sync them
    if (!document.getElementById('filter-panel')) {
        console.log('Creating filter panel on page load...');
        // Call toggleFilterPanel to create it
        toggleFilterPanel();
        // Immediately hide it
        setTimeout(() => {
            const panel = document.getElementById('filter-panel');
            if (panel) {
                panel.classList.remove('active');
                const filterBtn = document.getElementById('filter-btn');
                if (filterBtn) filterBtn.classList.remove('active');
            }
        }, 50);
    }
    
    
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
// ============================================================
// START DYNAMIC TIME UPDATES WITH AGGRESSIVE COMPLETION CHECK
// ============================================================
// Replace the existing startDynamicTimeUpdates() call with this:

// Start dynamic time updates with aggressive completion checking
startDynamicTimeUpdates();

// Also run completion check every 10 seconds (in addition to the one in startDynamicTimeUpdates)
setInterval(() => {
    updateCompletedJobs();
}, 10000);

// Run an initial completion check after 3 seconds
setTimeout(() => {
    console.log('🔄 Running initial completion check...');
    updateCompletedJobs();
}, 3000);



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
    // After data loads, run an initial completion check
setTimeout(() => {
    console.log('🔄 Running initial completion check...');
    updateCompletedJobs();
}, 3000);

// Also run it after any data sync
if (typeof supabaseSyncAllData === 'function') {
    const originalSync = supabaseSyncAllData;
    supabaseSyncAllData = async function(...args) {
        const result = await originalSync.apply(this, args);
        setTimeout(() => {
            updateCompletedJobs();
        }, 1000);
        return result;
    };
}
    
    // ============================================================
    // STEP 2: Setup auto-save after data loads
    // ============================================================
    setupAutoSaveTriggers();
        // THIS LINE TO ENABLE THE FLUSH BUTTON
        initEmergencyFlush();

    console.log('Application initialized successfully');
}

// ============================================================
// EMERGENCY FLUSH - Clear all data from database
// ============================================================

// Add this to main.js or create a separate file

function setupEmergencyFlush() {
    const flushBtn = document.getElementById('emergency-flush-btn');
    if (!flushBtn) return;
    
    // Show the button (hidden by default for safety)
    // You can remove the style="display:none" from HTML or use this:
    // flushBtn.style.display = 'inline-block';
    
    flushBtn.addEventListener('click', function(e) {
        e.preventDefault();
        showFlushConfirmation();
    });
}

function showFlushConfirmation() {
    // Check if modal already exists
    let overlay = document.getElementById('flush-modal-overlay');
    if (overlay) {
        overlay.classList.add('active');
        return;
    }
    
    overlay = document.createElement('div');
    overlay.id = 'flush-modal-overlay';
    overlay.className = 'flush-modal-overlay';
    
    overlay.innerHTML = `
        <div class="flush-modal">
            <div class="flush-icon">⚠️</div>
            <h2>Emergency Flush</h2>
            <p>This will <strong>permanently delete ALL data</strong> from the database:</p>
            <ul style="text-align:left; color:#6c757d; font-size:13px; margin:8px 0 12px 20px;">
                <li>All jobs</li>
                <li>All PL data</li>
                <li>All AW data</li>
                <li>All schedules</li>
                <li>All speeds</li>
            </ul>
            <div class="warning-text">
                ⚠️ This action <strong>CANNOT BE UNDONE</strong>!
            </div>
            <div class="flush-input-group">
                <label>Type <strong>FLUSH</strong> to confirm:</label>
                <input type="text" id="flush-confirm-input" placeholder="Type FLUSH here..." autocomplete="off">
            </div>
            <div class="flush-buttons">
                <button class="btn-flush-cancel" id="flush-cancel">Cancel</button>
                <button class="btn-flush-confirm" id="flush-confirm" disabled>Flush All Data</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(overlay);
    overlay.classList.add('active');
    
    // Setup event listeners
    const confirmInput = document.getElementById('flush-confirm-input');
    const confirmBtn = document.getElementById('flush-confirm');
    const cancelBtn = document.getElementById('flush-cancel');
    
    confirmInput.addEventListener('input', function() {
        const isValid = this.value.trim().toUpperCase() === 'FLUSH';
        confirmBtn.disabled = !isValid;
        if (isValid) {
            this.classList.remove('error');
        } else {
            this.classList.add('error');
        }
    });
    
    confirmInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' && !confirmBtn.disabled) {
            executeFlush();
        }
    });
    
    cancelBtn.addEventListener('click', closeFlushModal);
    confirmBtn.addEventListener('click', executeFlush);
    
    // Close on overlay click
    overlay.addEventListener('click', function(e) {
        if (e.target === this) closeFlushModal();
    });
    
    // Focus the input
    setTimeout(() => confirmInput.focus(), 100);
}

function closeFlushModal() {
    const overlay = document.getElementById('flush-modal-overlay');
    if (overlay) {
        overlay.classList.remove('active');
        setTimeout(() => overlay.remove(), 300);
    }
}

async function executeFlush() {
    const confirmBtn = document.getElementById('flush-confirm');
    const confirmInput = document.getElementById('flush-confirm-input');
    
    // Double-check confirmation
    if (confirmInput.value.trim().toUpperCase() !== 'FLUSH') {
        return;
    }
    
    // Disable button and show progress
    confirmBtn.disabled = true;
    confirmBtn.textContent = 'Flushing...';
    
    // Show progress in modal
    const modal = document.querySelector('.flush-modal');
    const progressDiv = document.createElement('div');
    progressDiv.className = 'flush-progress';
    progressDiv.innerHTML = `
        <div class="spinner"></div>
        <div class="progress-text">Deleting all data...</div>
    `;
    
    // Replace content with progress
    const contentNodes = modal.querySelectorAll('.flush-icon, h2, p, ul, .warning-text, .flush-input-group, .flush-buttons');
    contentNodes.forEach(node => node.style.display = 'none');
    modal.appendChild(progressDiv);
    
    try {
        // Execute the flush
        const result = await performFlush();
        
        // Show success
        progressDiv.innerHTML = `
            <div style="color: #28a745; font-size: 48px; margin-bottom: 12px;">✅</div>
            <div class="flush-success">All data flushed successfully!</div>
            <div style="margin-top: 12px; color: #6c757d; font-size: 13px;">
                ${result.jobsDeleted} jobs deleted<br>
                ${result.schedulesDeleted} schedules deleted<br>
                ${result.speedsDeleted} speeds deleted<br>
                ${result.plDeleted} PL records deleted<br>
                ${result.awDeleted} AW records deleted
            </div>
            <button class="btn-flush-cancel" id="flush-done" style="margin-top: 16px; padding: 10px 30px;">
                Done
            </button>
        `;
        
        document.getElementById('flush-done').addEventListener('click', function() {
            closeFlushModal();
            // Reload the page to reset state
            if (confirm('The page will reload to refresh all data. Continue?')) {
                window.location.reload();
            }
        });
        
        showNotification('✅ All data flushed successfully!', 'success');
        
    } catch (error) {
        console.error('Flush error:', error);
        progressDiv.innerHTML = `
            <div style="color: #dc3545; font-size: 48px; margin-bottom: 12px;">❌</div>
            <div class="flush-error">Error: ${error.message}</div>
            <button class="btn-flush-cancel" id="flush-retry" style="margin-top: 16px; padding: 10px 30px;">
                Try Again
            </button>
        `;
        
        document.getElementById('flush-retry').addEventListener('click', function() {
            closeFlushModal();
            setTimeout(showFlushConfirmation, 300);
        });
        
        showNotification('❌ Flush failed: ' + error.message, 'error');
    }
}

async function performFlush() {
    const client = initSupabase();
    if (!client) throw new Error('Supabase client not initialized');
    
    const results = {
        jobsDeleted: 0,
        schedulesDeleted: 0,
        speedsDeleted: 0,
        plDeleted: 0,
        awDeleted: 0
    };
    
    // 1. Delete from child tables first (FOREIGN KEY constraints)
    console.log('🗑️ Deleting schedules...');
    const { error: scheduleError } = await client
        .from('job_schedule')
        .delete()
        .neq('job_id', 'non-existent-id'); // Delete all
    
    if (scheduleError) throw new Error('Failed to delete schedules: ' + scheduleError.message);
    results.schedulesDeleted = 'all';
    
    console.log('🗑️ Deleting speeds...');
    const { error: speedError } = await client
        .from('job_speeds')
        .delete()
        .neq('job_id', 'non-existent-id');
    
    if (speedError) throw new Error('Failed to delete speeds: ' + speedError.message);
    results.speedsDeleted = 'all';
    
    // 2. Delete parent tables
    console.log('🗑️ Deleting jobs...');
    const { error: jobsError } = await client
        .from('jobs')
        .delete()
        .neq('job_id', 'non-existent-id');
    
    if (jobsError) throw new Error('Failed to delete jobs: ' + jobsError.message);
    results.jobsDeleted = 'all';
    
    console.log('🗑️ Deleting PL data...');
    const { error: plError } = await client
        .from('pl_database')
        .delete()
        .neq('job_id', 'non-existent-id');
    
    if (plError) throw new Error('Failed to delete PL data: ' + plError.message);
    results.plDeleted = 'all';
    
    console.log('🗑️ Deleting AW data...');
    const { error: awError } = await client
        .from('aw_data')
        .delete()
        .neq('job_number', 'non-existent-id');
    
    if (awError) throw new Error('Failed to delete AW data: ' + awError.message);
    results.awDeleted = 'all';
    
    // 3. Reset upload status (keep the users but reset status)
    console.log('🔄 Resetting upload status...');
    const { error: uploadError } = await client
        .from('upload_status')
        .update({ 
            status: 'pending',
            last_updated: null,
            file_name: null,
            file_size: null,
            job_count: 0
        })
        .neq('uploader', 'non-existent-id');
    
    if (uploadError) {
        console.warn('⚠️ Could not reset upload status:', uploadError.message);
    }
    
    // 4. Re-insert default data
    console.log('📥 Re-inserting default data...');
    try {
        await client
            .from('upload_status')
            .upsert([
                { uploader: 'mahmoud', status: 'pending' },
                { uploader: 'raed', status: 'pending' },
                { uploader: 'rabia', status: 'pending' },
                { uploader: 'qasem', status: 'pending' }
            ], { onConflict: 'uploader' });
    } catch (e) {
        console.warn('⚠️ Could not re-insert upload status:', e.message);
    }
    
    try {
        await client
            .from('system_config')
            .upsert([
                { config_key: 'default_speed', config_value: '200', description: 'Default machine speed in m/min' },
                { config_key: 'default_setup', config_value: '120', description: 'Default setup time in minutes' },
                { config_key: 'upload_validity_minutes', config_value: '1440', description: 'Upload validity period in minutes (24 hours)' },
                { config_key: 'max_printed_jobs', config_value: '3', description: 'Maximum number of printed jobs to keep on timeline' },
                { config_key: 'default_priority', config_value: '999', description: 'Default priority for jobs without priority' }
            ], { onConflict: 'config_key' });
    } catch (e) {
        console.warn('⚠️ Could not re-insert system config:', e.message);
    }
    
    // 5. Clear local data
    console.log('🧹 Clearing local data...');
    Object.keys(jobDatabase).forEach(key => delete jobDatabase[key]);
    Object.keys(plDatabase).forEach(key => delete plDatabase[key]);
    Object.keys(awData).forEach(key => delete awData[key]);
    Object.keys(jobSchedule).forEach(key => delete jobSchedule[key]);
    Object.keys(jobSpeeds).forEach(key => delete jobSpeeds[key]);
    
    console.log('✅ Flush complete!');
    return results;
}

// ============================================================
// INITIALIZE FLUSH BUTTON
// ============================================================
// Call this from initializeApp() or DOMContentLoaded

function initEmergencyFlush() {
    // Show the button (if hidden)
    const flushBtn = document.getElementById('emergency-flush-btn');
    if (flushBtn) {
        flushBtn.style.display = 'inline-block';
        flushBtn.title = '⚠️ Emergency Flush - Delete ALL data';
    }
    
    setupEmergencyFlush();
    console.log('⚠️ Emergency Flush button initialized');
}

// Uncomment this line when you're ready to enable the button
// document.addEventListener('DOMContentLoaded', initEmergencyFlush);

// Expose functions to window
window.setupEmergencyFlush = setupEmergencyFlush;
window.initEmergencyFlush = initEmergencyFlush;
window.performFlush = performFlush;
window.showFlushConfirmation = showFlushConfirmation;
window.closeFlushModal = closeFlushModal;
// ============================================================
// REBUILD TIMELINES FROM SCHEDULES
// ============================================================
function rebuildTimelinesFromSchedules() {
    console.log('🔄 Rebuilding timelines from schedules...');
    
    const scheduleEntries = Object.entries(jobSchedule);
    console.log(`📊 Found ${scheduleEntries.length} schedules in memory`);
    
    if (scheduleEntries.length === 0) {
        console.log('⚠️ No schedules found in memory');
        return;
    }
    
    // Clear existing timeline jobs FIRST (both printed and non-printed)
    document.querySelectorAll('.timeline').forEach(timeline => {
        const jobs = timeline.querySelectorAll('.job');
        jobs.forEach(job => {
            const jobId = job.getAttribute('data-job-id');
            // Don't delete from jobSchedule here, we're rebuilding from it
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
    
    // Process each timeline
    for (const [timelineId, jobs] of Object.entries(groupedByTimeline)) {
        // Sort by start time
        jobs.sort((a, b) => a.schedule.startTime - b.schedule.startTime);
        
        const timeline = document.getElementById(timelineId);
        if (!timeline) {
            console.warn(`⚠️ Timeline ${timelineId} not found in DOM`);
            continue;
        }
        
        console.log(`📊 Adding ${jobs.length} jobs to ${timelineId}`);
        
        // Filter out jobs that are Complete or don't exist in database
        const validJobs = jobs.filter(({ jobId, schedule }) => {
            const jobData = jobDatabase[jobId];
            if (!jobData) {
                console.warn(`⚠️ Job data not found for ${jobId}, removing from schedule`);
                delete jobSchedule[jobId];
                return false;
            }
            
            // ⭐ Skip completed jobs (they should not be on timeline)
            if (jobData.planningStatus === 'Complete' || jobData.isComplete === true) {
                console.log(`⏭️ Skipping completed job ${jobId} from timeline`);
                delete jobSchedule[jobId];
                return false;
            }
            
            return true;
        });
        
        // Separate printed and non-printed jobs
        const printedJobs = validJobs.filter(j => j.schedule.isPrinted === true);
        const nonPrintedJobs = validJobs.filter(j => j.schedule.isPrinted !== true);
        
        // ⭐ For printed jobs: keep only the most recent one
        printedJobs.sort((a, b) => b.schedule.endTime - a.schedule.endTime);
        const keptPrinted = printedJobs.slice(0, 1);
        const removedPrinted = printedJobs.slice(1);
        
        // Remove old printed jobs from schedule
        removedPrinted.forEach(({ jobId }) => {
            delete jobSchedule[jobId];
            console.log(`🗑️ Removed old printed job ${jobId} from ${timelineId}`);
        });
        
        // Clear timeline
        while (timeline.firstChild) {
            timeline.removeChild(timeline.firstChild);
        }
        
        // ⭐ Add printed jobs FIRST (left side)
        keptPrinted.forEach(({ jobId, schedule }) => {
            const jobData = jobDatabase[jobId];
            if (!jobData) return;
            
            const jobElement = createJobElement(jobId, jobData);
            // Ensure it's marked as printed
            if (!jobElement.classList.contains('job-printed')) {
                jobElement.classList.add('job-printed');
            }
            jobElement.setAttribute('draggable', 'false');
            timeline.appendChild(jobElement);
            updateJobTimeDisplay(jobId);
        });
        
        // ⭐ Add non-printed jobs AFTER printed ones
        nonPrintedJobs.forEach(({ jobId, schedule }) => {
            const jobData = jobDatabase[jobId];
            if (!jobData) return;
            
            const jobElement = createJobElement(jobId, jobData);
            timeline.appendChild(jobElement);
            updateJobTimeDisplay(jobId);
        });
        
        // Sort non-printed jobs by priority
        const nonPrintedElements = Array.from(timeline.querySelectorAll('.job:not(.job-printed)'));
        if (nonPrintedElements.length > 1) {
            nonPrintedElements.sort((a, b) => {
                const aId = a.getAttribute('data-job-id');
                const bId = b.getAttribute('data-job-id');
                const aPriority = jobDatabase[aId]?.priority !== undefined ? jobDatabase[aId].priority : 999;
                const bPriority = jobDatabase[bId]?.priority !== undefined ? jobDatabase[bId].priority : 999;
                return aPriority - bPriority;
            });
            
            // Get printed jobs
            const printedEls = Array.from(timeline.querySelectorAll('.job.job-printed'));
            
            // Clear timeline
            while (timeline.firstChild) {
                timeline.removeChild(timeline.firstChild);
            }
            
            // Add printed first, then sorted non-printed
            printedEls.forEach(job => timeline.appendChild(job));
            nonPrintedElements.forEach(job => timeline.appendChild(job));
        }
    }
    
    // Update all timelines
    document.querySelectorAll('.timeline').forEach(timeline => {
        // Final check: ensure printed jobs are at the beginning
        const printedJobs = Array.from(timeline.querySelectorAll('.job.job-printed'));
        const nonPrintedJobs = Array.from(timeline.querySelectorAll('.job:not(.job-printed)'));
        
        if (printedJobs.length > 0) {
            const firstJob = timeline.firstChild;
            if (firstJob && !firstJob.classList.contains('job-printed')) {
                printedJobs.forEach(job => job.remove());
                printedJobs.forEach(job => {
                    timeline.insertBefore(job, timeline.firstChild);
                });
            }
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
    
    console.log('✅ Timelines rebuilt from schedules');
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
