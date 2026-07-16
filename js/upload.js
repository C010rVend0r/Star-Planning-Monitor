// script-upload.js - UNIFIED SMART UPLOAD
// ============================================================
// UPLOAD STATUS TRACKING & FAST PROCESSING
// ============================================================

// Upload status tracking
const uploadStatus = {
    mahmoud: { lastUpdated: null, status: 'pending' },
    raed: { lastUpdated: null, status: 'pending' },
    rabia: { lastUpdated: null, status: 'pending' },
    qasem: { lastUpdated: null, status: 'pending' }
};

const UPLOAD_VALIDITY_MINUTES = 1440; // 24 hours
let statusCheckInterval = null;

// Sheet detection patterns
const SHEET_PATTERNS = {
    mahmoud: ['mahmoud'],
    raed: ['raed'],
    rabia: ['rabia'],
    fullData: ['full data', 'fulldata', 'full']
};

// ============================================================
// CALCULATE ESTIMATED DATE - Excluding Fridays
// ============================================================
function calculateEstimatedDate(startDate, daysToAdd) {
    if (!startDate || isNaN(startDate.getTime())) {
        return null;
    }
    
    const result = new Date(startDate);
    let daysAdded = 0;
    
    while (daysAdded < daysToAdd) {
        result.setDate(result.getDate() + 1);
        if (result.getDay() !== 5) {
            daysAdded++;
        }
    }
    return result;
}

// ============================================================
// DETECT UPLOADER
// ============================================================
function detectUploader(sheetNames) {
    const results = {
        mahmoud: false,
        raed: false,
        rabia: false,
        fullData: false
    };
    
    const lowerSheetNames = sheetNames.map(name => name.toLowerCase().trim());
    
    if (lowerSheetNames.some(name => 
        SHEET_PATTERNS.fullData.some(pattern => name.includes(pattern))
    )) {
        results.fullData = true;
        results.mahmoud = true;
        results.raed = true;
        results.rabia = true;
        return results;
    }
    
    if (lowerSheetNames.some(name => 
        SHEET_PATTERNS.mahmoud.some(pattern => name.includes(pattern))
    )) {
        results.mahmoud = true;
    }
    
    if (lowerSheetNames.some(name => 
        SHEET_PATTERNS.raed.some(pattern => name.includes(pattern))
    )) {
        results.raed = true;
    }
    
    if (lowerSheetNames.some(name => 
        SHEET_PATTERNS.rabia.some(pattern => name.includes(pattern))
    )) {
        results.rabia = true;
    }
    
    return results;
}

function updateUploadStatus(uploader) {
    const now = new Date();
    uploadStatus[uploader].lastUpdated = now;
    uploadStatus[uploader].status = 'updated';
    updateStatusIndicators();
    console.log(`✅ ${uploader} upload status updated at ${now.toLocaleTimeString()}`);
}

function checkUploadValidity() {
    const now = new Date();
    let allUpdated = true;
    
    for (const [key, value] of Object.entries(uploadStatus)) {
        if (value.lastUpdated === null) {
            value.status = 'pending';
            allUpdated = false;
        } else {
            const diffMinutes = (now - value.lastUpdated) / (1000 * 60);
            if (diffMinutes > UPLOAD_VALIDITY_MINUTES) {
                value.status = 'expired';
                allUpdated = false;
            } else {
                value.status = 'updated';
            }
        }
    }
    
    updateStatusIndicators(allUpdated);
    return allUpdated;
}

// ============================================================
// UPDATE STATUS INDICATORS
// ============================================================
function updateStatusIndicators(allUpdated = null) {
    let statusContainer = document.getElementById('upload-status-container');
    
    if (!statusContainer) {
        statusContainer = document.createElement('div');
        statusContainer.id = 'upload-status-container';
        const header = document.querySelector('.header');
        if (header) {
            header.parentNode.insertBefore(statusContainer, header.nextSibling);
        } else {
            document.body.prepend(statusContainer);
        }
    }
    
    const statusConfigs = [
        { key: 'mahmoud', label: 'Mahmoud' },
        { key: 'raed', label: 'Raed' },
        { key: 'rabia', label: 'Rabia' },
        { key: 'qasem', label: 'Qasem' }
    ];
    
    const isAllUpdated = statusConfigs.every(c => uploadStatus[c.key].status === 'updated');
    
    if (isAllUpdated) {
        statusContainer.innerHTML = `
            <div class="upload-status-item status-all-updated">
                <span>✅ All Data are updated !!</span>
            </div>
        `;
        return;
    }
    
    let statusHTML = '';
    let pendingCount = 0;
    let pendingNames = [];
    
    for (const config of statusConfigs) {
        const status = uploadStatus[config.key];
        
        if (status.status !== 'updated') {
            let statusClass = 'status-pending';
            let statusText = '⏳ Pending';
            let icon = '🔴';
            
            if (status.status === 'expired') {
                statusText = '⚠️ Please update!';
                statusClass = 'status-expired';
            } else {
                statusText = '⏳ Waiting...';
                statusClass = 'status-pending';
            }
            
            pendingCount++;
            pendingNames.push(config.label);
            
            statusHTML += `
                <div class="upload-status-item ${statusClass}">
                    <span class="status-warning-icon">${icon}</span>
                    <span class="status-label">${config.label}:</span>
                    <span class="status-text">${statusText}</span>
                </div>
            `;
        }
    }
    
    const summaryHTML = `
        <div class="upload-status-item status-some-pending">
            <span>⚠️</span>
            <span><strong>${pendingCount}</strong> update${pendingCount > 1 ? 's' : ''} pending: <strong>${pendingNames.join(', ')}</strong></span>
        </div>
    `;
    
    statusContainer.innerHTML = statusHTML + summaryHTML;
}

// ============================================================
// UPDATE REAL TIME INDICATOR
// ============================================================
function updateRealTimeIndicator() {
    const statCards = document.querySelectorAll('.stat-card');
    let realTimeCard = null;
    
    for (const card of statCards) {
        const label = card.querySelector('.stat-label');
        if (label && label.textContent.trim() === 'Real Time') {
            realTimeCard = card;
            break;
        }
    }
    
    if (!realTimeCard) {
        if (statCards.length >= 3) {
            realTimeCard = statCards[2];
        } else {
            return;
        }
    }
    
    const statValue = realTimeCard.querySelector('.stat-value');
    if (!statValue) return;
    
    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    statValue.textContent = timeStr;
}

// ============================================================
// HELPER FUNCTIONS
// ============================================================
function findJobIdByNumber(jobNumber) {
    if (!jobNumber) return null;
    
    const cleanNumber = jobNumber.trim();
    if (!cleanNumber) return null;
    
    for (const [id, data] of Object.entries(jobDatabase)) {
        if (data.jobNumber && data.jobNumber.trim() === cleanNumber) {
            return id;
        }
    }
    return null;
}

function showUploadProgress(message, percentage) {
    let progressElement = document.querySelector('.upload-progress');
    if (!progressElement) {
        progressElement = document.createElement('div');
        progressElement.className = 'upload-progress';
        progressElement.innerHTML = `
            <div class="progress-text">Uploading...</div>
            <div class="progress-bar"><div class="progress-fill" style="width: 0%"></div></div>
        `;
        document.body.appendChild(progressElement);
    }
    const textElement = progressElement.querySelector('.progress-text');
    const fillElement = progressElement.querySelector('.progress-fill');
    if (textElement) textElement.textContent = message;
    if (fillElement) fillElement.style.width = `${Math.min(percentage, 100)}%`;
    progressElement.classList.add('active');
}

function hideUploadProgress() {
    const progressElement = document.querySelector('.upload-progress');
    if (progressElement) {
        progressElement.classList.remove('active');
        setTimeout(() => progressElement.remove(), 500);
    }
}

// ============================================================
// SMART PL UPLOAD - SINGLE UNIFIED FUNCTION
// ============================================================
async function smartPLUpload(file) {
    console.log('🚀 SMART PL UPLOAD STARTED:', file.name);
    
    showUploadProgress('📖 Reading PL file...', 5);
    
    const reader = new FileReader();
    
    reader.onload = async function(e) {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            
            let sheet = null;
            for (const name of workbook.SheetNames) {
                if (name.toLowerCase().includes('plan-week')) {
                    sheet = workbook.Sheets[name];
                    break;
                }
            }
            
            if (!sheet) {
                alert('❌ Sheet "PLAN-WEEK" not found in the file!');
                hideUploadProgress();
                return;
            }
            
            const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 });
            const rows = jsonData.slice(1);
            
            console.log(`📊 Processing ${rows.length} rows...`);
            showUploadProgress(`📊 Processing ${rows.length} rows...`, 10);
            
            // STEP 1: Check for existing data
            const existingJobs = await supabaseLoadAllJobs();
            const existingJobMap = new Map();
            const completeJobNumbers = new Set();
            
            if (existingJobs && existingJobs.length > 0) {
                existingJobs.forEach(job => {
                    existingJobMap.set(job.job_number, job);
                    if (job.planning_status === 'Complete' || job.planning_status === 'Printed') {
                        completeJobNumbers.add(job.job_number);
                    }
                });
                console.log(`📌 Found ${existingJobs.length} existing jobs, ${completeJobNumbers.size} are COMPLETE`);
            }
            
            // STEP 2: Filter and process jobs
            const BATCH_SIZE = 200;
            let totalProcessed = 0;
            let totalSkippedComplete = 0;
            let totalSkippedInvalid = 0;
            let totalNewJobs = 0;
            let totalUpdatedJobs = 0;
            const startTime = Date.now();
            
            // Process in batches
            for (let i = 0; i < rows.length; i += BATCH_SIZE) {
                const batch = rows.slice(i, i + BATCH_SIZE);
                const jobsToSave = {};
                const plDataToSave = {};
                let batchProcessed = 0;
                
                for (const row of batch) {
                    if (!row || row.length < 25) {
                        totalSkippedInvalid++;
                        continue;
                    }
                    
                    const jobNumber = String(row[0] || '').trim();
                    if (!jobNumber) {
                        totalSkippedInvalid++;
                        continue;
                    }
                    
                    const planningStatus = String(row[5] || '').trim() || 'Unplanned';
                    
                    // ⚡ SKIP if already COMPLETE in database
                    if (completeJobNumbers.has(jobNumber) && planningStatus === 'Complete') {
                        totalSkippedComplete++;
                        continue;
                    }
                    
                    const jobName = String(row[1] || '').trim();
                    const newPlat = String(row[2] || '').trim();
                    const materialAvailability = String(row[4] || '').trim();
                    const delivered = String(row[6] || '').trim();
                    const delivered2 = String(row[7] || '').trim();
                    const machine = String(row[8] || '').trim();
                    const cuttingMethod = String(row[10] || '').trim();
                    const quantity = parseFloat(row[11]) || 0;
                    const film = String(row[12] || '').trim();
                    const thickness = String(row[13] || '').trim();
                    const materialType = String(row[14] || '').trim();
                    const machineSpeed = parseFloat(row[15]) || 200;
                    const meters = parseFloat(row[16]) || 0;
                    const setupTime = parseFloat(row[17]) || 120;
                    const requiredTime = parseFloat(row[18]) || 0;
                    const plannedSpeed = parseFloat(row[19]) || 200;
                    const actualSpeed = parseFloat(row[20]) || 200;
                    const plannedSetup = parseFloat(row[21]) || 120;
                    const actualSetup = parseFloat(row[22]) || 0;
                    const downtime = parseFloat(row[23]) || 0;
                    const printingDuration = parseFloat(row[24]) || 0;
                    
                    const jobId = `job-${jobNumber}`;
                    
                    // Check if job exists and get AW data
                    let awStatus = 'Unknown';
                    let statusDate = new Date(1900, 0, 1).toISOString();
                    let estimatedDate = null;
                    const existingJob = existingJobMap.get(jobNumber);
                    
                    if (existingJob) {
                        awStatus = existingJob.aw_status || 'Unknown';
                        statusDate = existingJob.status_date || new Date(1900, 0, 1).toISOString();
                        estimatedDate = existingJob.estimated_date || null;
                        totalUpdatedJobs++;
                    } else {
                        totalNewJobs++;
                    }
                    
                    // Determine effective status
                    let effectiveStatus = awStatus;
                    if (planningStatus === 'Complete' || planningStatus === 'Printed') {
                        effectiveStatus = 'Complete';
                    } else if (planningStatus === 'Planned') {
                        effectiveStatus = 'Planned';
                    } else if (planningStatus === 'Unplanned') {
                        effectiveStatus = 'Unplanned';
                    } else if (planningStatus === 'Deleted' || planningStatus === 'PL-Deleted') {
                        effectiveStatus = 'PL-Deleted';
                    } else if (planningStatus === 'Hold' || planningStatus === 'PL-Hold') {
                        effectiveStatus = 'PL-Hold';
                    } else if (awStatus === 'Unknown') {
                        effectiveStatus = planningStatus || 'Unplanned';
                    }
                    
                    // Save to jobs table
                    jobsToSave[jobId] = {
                        job_id: jobId,
                        job_number: jobNumber,
                        name: jobName || 'Unnamed',
                        status: effectiveStatus,
                        aw_status: awStatus,
                        raw_aw_status: awStatus,
                        planning_status: planningStatus,
                        status_date: statusDate,
                        estimated_date: estimatedDate,
                        setup: setupTime || plannedSetup || 120,
                        quantity: meters || quantity || 0,
                        machine: machine || '',
                        is_complete: planningStatus === 'Complete' || planningStatus === 'Printed',
                        is_planned: planningStatus === 'Planned',
                        is_unplanned: planningStatus === 'Unplanned',
                        is_deleted: planningStatus === 'Deleted' || planningStatus === 'PL-Deleted',
                        is_hold: planningStatus === 'Hold' || planningStatus === 'PL-Hold',
                        new_plat: newPlat,
                        material_availability: materialAvailability,
                        delivered: delivered,
                        delivered2: delivered2,
                        cutting_method: cuttingMethod,
                        film: film,
                        thickness: thickness,
                        material_type: materialType,
                        machine_speed: machineSpeed,
                        meters: meters,
                        setup_time: setupTime,
                        required_time: requiredTime,
                        planned_speed: plannedSpeed,
                        actual_speed: actualSpeed,
                        planned_setup: plannedSetup,
                        actual_setup: actualSetup,
                        downtime: downtime,
                        printing_duration: printingDuration
                    };
                    
                    // Save to PL table
                    plDataToSave[jobId] = {
                        job_id: jobId,
                        job_number: jobNumber,
                        job_name: jobName || 'Unnamed',
                        new_plat: newPlat,
                        prepress_status: awStatus || 'Unknown',
                        material_availability: materialAvailability,
                        planning_status: planningStatus,
                        delivered: delivered,
                        delivered2: delivered2,
                        machine: machine,
                        cutting_method: cuttingMethod,
                        quantity: quantity,
                        film: film,
                        thickness: thickness,
                        material_type: materialType,
                        machine_speed: machineSpeed,
                        meters: meters,
                        setup_time: setupTime,
                        required_time: requiredTime,
                        planned_speed: plannedSpeed,
                        actual_speed: actualSpeed,
                        planned_setup: plannedSetup,
                        actual_setup: actualSetup,
                        downtime: downtime,
                        printing_duration: printingDuration,
                        is_complete: planningStatus === 'Complete',
                        is_planned: planningStatus === 'Planned',
                        is_unplanned: planningStatus === 'Unplanned',
                        is_deleted: planningStatus === 'Deleted',
                        is_hold: planningStatus === 'Hold',
                        status_date: statusDate,
                        estimated_date: estimatedDate
                    };
                    
                    batchProcessed++;
                    totalProcessed++;
                }
                
                // Save batch
                if (Object.keys(jobsToSave).length > 0) {
                    await supabaseSaveMultipleJobs(jobsToSave);
                    for (const [jobId, data] of Object.entries(plDataToSave)) {
                        await supabaseSavePLData(jobId, data);
                    }
                }
                
                // Update progress
                const percent = Math.min(100, Math.round((totalProcessed / rows.length) * 100));
                const elapsed = Math.round((Date.now() - startTime) / 1000);
                const summary = `📊 ${totalProcessed}/${rows.length} rows (${totalNewJobs} new, ${totalUpdatedJobs} updated, ${totalSkippedComplete} complete skipped)`;
                showUploadProgress(`${summary} - ${elapsed}s`, percent);
                console.log(`✅ ${percent}% - ${summary}`);
            }
            
            const totalTime = Math.round((Date.now() - startTime) / 1000);
            
            // Final summary
            const finalSummary = `
╔═══════════════════════════════════════════════════════╗
║                    📊 UPLOAD SUMMARY                  ║
╠═══════════════════════════════════════════════════════╣
║  ✅ Total processed:  ${totalProcessed} jobs          ║
║  🆕 New jobs:         ${totalNewJobs}                 ║
║  🔄 Updated jobs:     ${totalUpdatedJobs}             ║
║  ⏭️  Complete skipped: ${totalSkippedComplete}        ║
║  ⏱️  Time:             ${totalTime} seconds           ║
╚═══════════════════════════════════════════════════════╝
`;
            console.log(finalSummary);
            
            // Update upload status
            updateUploadStatus('qasem');
            
            showUploadProgress(`✅ ${totalProcessed} jobs processed (${totalNewJobs} new, ${totalUpdatedJobs} updated)`, 100);
            
            // Refresh UI
            setTimeout(async () => {
                await supabaseSyncAllData();
                populateProductionFeed();
                hideUploadProgress();
                showNotification(
                    `✅ ${totalProcessed} jobs processed: ${totalNewJobs} new, ${totalUpdatedJobs} updated, ${totalSkippedComplete} complete jobs skipped`,
                    'success'
                );
                updateStatistics();
            }, 1000);
            
        } catch (error) {
            console.error('❌ Upload failed:', error);
            hideUploadProgress();
            alert('❌ Upload failed: ' + error.message);
        }
    };
    
    reader.readAsArrayBuffer(file);
}

// ============================================================
// AW UPLOAD - SMART, SKIPS COMPLETE JOBS
// ============================================================
function handleAWUpload(file) {
    console.log('📤 Uploading AW Excel file:', file.name);
    
    showUploadProgress('📖 Reading AW file...', 10);
    
    const reader = new FileReader();
    
    reader.onload = async function(e) {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            
            const sheetNames = workbook.SheetNames;
            console.log('AW Sheets found:', sheetNames);
            
            const detected = detectUploader(sheetNames);
            console.log('Detected uploaders:', detected);
            
            const firstSheet = workbook.Sheets[sheetNames[0]];
            const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });
            
            showUploadProgress('🔄 Processing AW data...', 30);
            
            const rows = jsonData.slice(3);
            let awJobsFound = 0;
            let awJobsSkipped = 0;
            
            const savedFilterStatuses = new Set(filterStatuses);
            const jobsToUpdate = {};
            const awDataToSave = {};
            
            // Get existing jobs to check COMPLETE status
            const existingJobs = await supabaseLoadAllJobs();
            const completeJobNumbers = new Set();
            
            if (existingJobs && existingJobs.length > 0) {
                existingJobs.forEach(job => {
                    if (job.planning_status === 'Complete' || job.planning_status === 'Printed') {
                        completeJobNumbers.add(job.job_number);
                    }
                });
                console.log(`📌 ${completeJobNumbers.size} COMPLETE jobs (AW updates will skip these)`);
            }
            
            for (const row of rows) {
                if (!row || row.length < 10) continue;
                
                const jobNumber = String(row[5] || '').trim();
                const status = String(row[8] || '').trim();
                
                if (!jobNumber) continue;
                
                // ⚡ SKIP if job is COMPLETE
                if (completeJobNumbers.has(jobNumber)) {
                    awJobsSkipped++;
                    continue;
                }
                
                let statusDate = null;
                
                const statusDateMap = {
                    '1. Under Job-Study': { index: 32 },
                    '2. Under QC Check': { index: 34 },
                    '3. S.C Approval': { index: 36 },
                    '4. Need S.C Approval': { index: 38 },
                    '5. Working on Cromalin': { index: 40 },
                    '6. Need Cromalin Approval': { index: 42 },
                    '7. Cromalin Approval': { index: 44 },
                    '8. Repro: Plate Making': { index: 46 },
                    '9. Plates are Ready': { index: 48 }
                };
                
                if (status && statusDateMap[status]) {
                    const dateInfo = statusDateMap[status];
                    const dateValue = row[dateInfo.index];
                    
                    if (dateValue !== undefined && dateValue !== null && dateValue !== '') {
                        if (typeof dateValue === 'number' && dateValue > 0) {
                            const excelEpoch = new Date(1899, 11, 30);
                            const jsDate = new Date(excelEpoch.getTime() + dateValue * 86400000);
                            if (!isNaN(jsDate.getTime())) {
                                statusDate = jsDate;
                            }
                        } else if (typeof dateValue === 'string') {
                            const parsed = new Date(dateValue);
                            if (!isNaN(parsed.getTime()) && parsed.getFullYear() > 1900) {
                                statusDate = parsed;
                            }
                        }
                    }
                }
                
                if (!statusDate) {
                    statusDate = new Date(1900, 0, 1);
                }
                
                let rawStatus = status || 'Unknown';
                
                let estimatedDate = null;
                if (rawStatus === '8. Repro: Plate Making' || rawStatus === '5. Working on Cromalin') {
                    estimatedDate = calculateEstimatedDate(statusDate, 2);
                }
                
                // Store AW data
                awData[jobNumber] = {
                    status: rawStatus,
                    rawStatus: rawStatus,
                    statusDate: statusDate.toISOString(),
                    estimatedDate: estimatedDate ? estimatedDate.toISOString() : null,
                    isFromAW: true
                };
                
                awDataToSave[jobNumber] = {
                    status: rawStatus,
                    raw_status: rawStatus,
                    status_date: statusDate.toISOString(),
                    estimated_date: estimatedDate ? estimatedDate.toISOString() : null,
                    is_from_aw: true
                };
                
                let jobId = findJobIdByNumber(jobNumber);
                
                if (jobId) {
                    if (jobDatabase[jobId]) {
                        jobDatabase[jobId].awStatus = rawStatus;
                        jobDatabase[jobId].status = rawStatus;
                        jobDatabase[jobId].statusDate = statusDate.toISOString();
                        jobDatabase[jobId].rawAWStatus = rawStatus;
                        jobDatabase[jobId].estimatedDate = estimatedDate ? estimatedDate.toISOString() : null;
                        
                        jobsToUpdate[jobId] = {
                            aw_status: rawStatus,
                            status: rawStatus,
                            status_date: statusDate.toISOString(),
                            estimated_date: estimatedDate ? estimatedDate.toISOString() : null,
                            raw_aw_status: rawStatus
                        };
                        
                        if (plDatabase[jobId]) {
                            plDatabase[jobId].prepressStatus = rawStatus;
                            plDatabase[jobId].statusDate = statusDate.toISOString();
                            plDatabase[jobId].rawAWStatus = rawStatus;
                            plDatabase[jobId].estimatedDate = estimatedDate ? estimatedDate.toISOString() : null;
                        }
                        
                        awJobsFound++;
                    }
                } else {
                    awJobsSkipped++;
                }
            }
            
            console.log(`AW results: ${awJobsFound} updated, ${awJobsSkipped} skipped (complete jobs)`);
            
            // Save to Supabase
            try {
                if (Object.keys(awDataToSave).length > 0) {
                    await supabaseSaveMultipleAWData(awDataToSave);
                    console.log(`✅ ${Object.keys(awDataToSave).length} AW records saved`);
                }
                
                if (Object.keys(jobsToUpdate).length > 0) {
                    await supabaseSaveMultipleJobs(jobsToUpdate);
                    console.log(`✅ ${Object.keys(jobsToUpdate).length} jobs updated`);
                }
            } catch (saveError) {
                console.error('❌ Error saving to Supabase:', saveError);
            }
            
            filterStatuses = savedFilterStatuses;
            
            populateProductionFeed();
            applyFilter();
            updateFilterCounts();
            updateStatistics();
            updateFilterBadge();
            syncFilterCheckboxes();
            
            if (detected.fullData) {
                updateUploadStatus('mahmoud');
                updateUploadStatus('raed');
                updateUploadStatus('rabia');
                showNotification(`✅ Full Data uploaded - ${awJobsFound} updated, ${awJobsSkipped} skipped (complete)`, 'success');
            } else {
                if (detected.mahmoud) updateUploadStatus('mahmoud');
                if (detected.raed) updateUploadStatus('raed');
                if (detected.rabia) updateUploadStatus('rabia');
                showNotification(`✅ AW data uploaded - ${awJobsFound} jobs updated`, 'success');
            }
            
            showUploadProgress(`✅ AW complete: ${awJobsFound} updated, ${awJobsSkipped} skipped`, 100);
            
            setTimeout(() => {
                hideUploadProgress();
                console.log('AW upload completed');
            }, 1500);
            
        } catch (error) {
            console.error('Error processing AW file:', error);
            hideUploadProgress();
            alert('Error reading AW file: ' + error.message);
        }
    };
    
    reader.onerror = function() {
        console.error('Error reading AW file');
        hideUploadProgress();
        alert('Error reading file. Please try again.');
    };
    
    reader.readAsArrayBuffer(file);
}

// ============================================================
// EXCEL UPLOAD SETUP - UNIFIED
// ============================================================
function setupExcelUploads() {
    console.log('Setting up Excel uploads...');
    
    // AW Upload
    const uploadBtnAW = document.getElementById('upload-excel-aw');
    const fileInputAW = document.getElementById('file-input-aw');
    
    if (uploadBtnAW && fileInputAW) {
        const newBtn = uploadBtnAW.cloneNode(true);
        uploadBtnAW.parentNode.replaceChild(newBtn, uploadBtnAW);
        
        newBtn.addEventListener('click', function(e) {
            e.preventDefault();
            fileInputAW.click();
        });
        
        fileInputAW.addEventListener('change', function(e) {
            const file = this.files[0];
            if (file) {
                console.log('AW file selected:', file.name);
                handleAWUpload(file);
            }
            this.value = '';
        });
    }
    
    // PL Upload - UNIFIED SMART VERSION
    const uploadBtnPL = document.getElementById('upload-excel-pl');
    const fileInputPL = document.getElementById('file-input-pl');
    
    if (uploadBtnPL && fileInputPL) {
        const newBtn = uploadBtnPL.cloneNode(true);
        uploadBtnPL.parentNode.replaceChild(newBtn, uploadBtnPL);
        
        // Add smart indicator
        newBtn.innerHTML = '<i class="fas fa-file-excel"></i> PL <span style="font-size:9px;background:#28a745;color:white;padding:1px 6px;border-radius:8px;margin-left:4px;">SMART</span>';
        
        newBtn.addEventListener('click', function(e) {
            e.preventDefault();
            fileInputPL.click();
        });
        
        fileInputPL.addEventListener('change', function(e) {
            const file = this.files[0];
            if (file) {
                console.log('PL file selected:', file.name);
                smartPLUpload(file);  // ← UNIFIED smart upload
            }
            this.value = '';
        });
    }
}

// ============================================================
// START STATUS MONITORING
// ============================================================
function startUploadStatusMonitoring() {
    checkUploadValidity();
    setTimeout(function() {
        updateStatusIndicators();
    }, 100);
    
    if (statusCheckInterval) {
        clearInterval(statusCheckInterval);
    }
    statusCheckInterval = setInterval(checkUploadValidity, 30000);
    
    console.log(`📊 Upload status monitoring started (validity: ${UPLOAD_VALIDITY_MINUTES} minutes)`);
}

// ============================================================
// EXPOSE FUNCTIONS TO WINDOW
// ============================================================
window.uploadStatus = uploadStatus;
window.updateUploadStatus = updateUploadStatus;
window.checkUploadValidity = checkUploadValidity;
window.updateStatusIndicators = updateStatusIndicators;
window.detectUploader = detectUploader;
window.startUploadStatusMonitoring = startUploadStatusMonitoring;
window.updateRealTimeIndicator = updateRealTimeIndicator;
window.setupExcelUploads = setupExcelUploads;
window.handleAWUpload = handleAWUpload;
window.smartPLUpload = smartPLUpload;
window.findJobIdByNumber = findJobIdByNumber;
window.calculateEstimatedDate = calculateEstimatedDate;

console.log('✅ Upload status tracking initialized');
