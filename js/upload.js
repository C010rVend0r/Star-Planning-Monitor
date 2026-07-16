// script-upload.js - COMPLETE VERSION WITH BULK UPLOAD
// ============================================================
// UPLOAD STATUS TRACKING & FAST BULK PROCESSING
// ============================================================

// Upload status tracking
const uploadStatus = {
    mahmoud: { lastUpdated: null, status: 'pending' },
    raed: { lastUpdated: null, status: 'pending' },
    rabia: { lastUpdated: null, status: 'pending' },
    qasem: { lastUpdated: null, status: 'pending' }
};

const UPLOAD_VALIDITY_MINUTES = 1440; // 24 hours (changed from 1 minute)
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
// BULK PL UPLOAD - SUPER FAST VERSION
// ============================================================
async function bulkPLUpload(file) {
    console.log('⚡ BULK PL UPLOAD STARTED:', file.name);
    
    showUploadProgress('📖 Reading file...', 5);
    
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
            
            // Build ALL jobs in bulk arrays
            const allJobs = [];
            const allPLData = [];
            let skippedComplete = 0;
            let skippedInvalid = 0;
            
            // Get existing complete jobs
            const existingJobs = await supabaseLoadAllJobs();
            const completeJobNumbers = new Set();
            if (existingJobs && existingJobs.length > 0) {
                existingJobs.forEach(job => {
                    if (job.planning_status === 'Complete' || job.planning_status === 'Printed') {
                        completeJobNumbers.add(job.job_number);
                    }
                });
                console.log(`📌 Found ${completeJobNumbers.size} COMPLETE jobs (will skip)`);
            }
            
            // Build data arrays
            for (const row of rows) {
                if (!row || row.length < 25) {
                    skippedInvalid++;
                    continue;
                }
                
                const jobNumber = String(row[0] || '').trim();
                if (!jobNumber) {
                    skippedInvalid++;
                    continue;
                }
                
                const planningStatus = String(row[5] || '').trim() || 'Unplanned';
                
                // Skip if already COMPLETE
                if (completeJobNumbers.has(jobNumber) && planningStatus === 'Complete') {
                    skippedComplete++;
                    continue;
                }
                
                const jobName = String(row[1] || '').trim() || 'Unnamed';
                const newPlat = String(row[2] || '').trim() || '';
                const materialAvailability = String(row[4] || '').trim() || '';
                const delivered = String(row[6] || '').trim() || '';
                const delivered2 = String(row[7] || '').trim() || '';
                const machine = String(row[8] || '').trim() || '';
                const cuttingMethod = String(row[10] || '').trim() || '';
                const quantity = parseFloat(row[11]) || 0;
                const film = String(row[12] || '').trim() || '';
                const thickness = String(row[13] || '').trim() || '';
                const materialType = String(row[14] || '').trim() || '';
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
                const isComplete = planningStatus === 'Complete' || planningStatus === 'Printed';
                
                // Get AW status from existing data if available
                let awStatus = 'Unknown';
                let statusDate = new Date(1900, 0, 1).toISOString();
                let estimatedDate = null;
                
                const existingJob = existingJobs?.find(j => j.job_number === jobNumber);
                if (existingJob) {
                    awStatus = existingJob.aw_status || 'Unknown';
                    statusDate = existingJob.status_date || new Date(1900, 0, 1).toISOString();
                    estimatedDate = existingJob.estimated_date || null;
                }
                
                let effectiveStatus = isComplete ? 'Complete' : (awStatus !== 'Unknown' ? awStatus : planningStatus);
                
                // Add to jobs array
                allJobs.push({
                    job_id: jobId,
                    job_number: jobNumber,
                    name: jobName,
                    status: effectiveStatus,
                    aw_status: awStatus,
                    raw_aw_status: awStatus,
                    planning_status: planningStatus,
                    status_date: statusDate,
                    estimated_date: estimatedDate,
                    setup: setupTime || plannedSetup || 120,
                    quantity: meters || quantity || 0,
                    machine: machine || '',
                    is_complete: isComplete,
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
                });
                
                // Add to PL data array
                allPLData.push({
                    job_id: jobId,
                    job_number: jobNumber,
                    job_name: jobName,
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
                    is_complete: isComplete,
                    is_planned: planningStatus === 'Planned',
                    is_unplanned: planningStatus === 'Unplanned',
                    is_deleted: planningStatus === 'Deleted',
                    is_hold: planningStatus === 'Hold',
                    status_date: statusDate,
                    estimated_date: estimatedDate
                });
            }
            
            const totalToProcess = allJobs.length;
            console.log(`📊 ${totalToProcess} jobs to upload (${skippedComplete} complete skipped, ${skippedInvalid} invalid)`);
            
            if (totalToProcess === 0) {
                showUploadProgress('✅ All jobs already up to date!', 100);
                setTimeout(() => {
                    hideUploadProgress();
                    showNotification('✅ All jobs are already in the database!', 'success');
                }, 1000);
                return;
            }
            
            showUploadProgress(`💾 Uploading ${totalToProcess} jobs in bulk...`, 20);
            
            const startTime = Date.now();
            const client = initSupabase();
            const CHUNK_SIZE = 500;
            
            // STEP 1: Bulk upsert jobs
            let jobsInserted = 0;
            for (let i = 0; i < allJobs.length; i += CHUNK_SIZE) {
                const chunk = allJobs.slice(i, i + CHUNK_SIZE);
                const { error } = await client
                    .from('jobs')
                    .upsert(chunk, { onConflict: 'job_id' });
                
                if (error) throw error;
                
                jobsInserted += chunk.length;
                const percent = Math.min(90, Math.round((jobsInserted / totalToProcess) * 90));
                const elapsed = Math.round((Date.now() - startTime) / 1000);
                showUploadProgress(`📊 ${jobsInserted}/${totalToProcess} jobs (${elapsed}s)`, percent);
                console.log(`✅ ${jobsInserted}/${totalToProcess} jobs inserted (${elapsed}s)`);
            }
            
            // STEP 2: Bulk upsert PL data
            let plInserted = 0;
            for (let i = 0; i < allPLData.length; i += CHUNK_SIZE) {
                const chunk = allPLData.slice(i, i + CHUNK_SIZE);
                const { error } = await client
                    .from('pl_database')
                    .upsert(chunk, { onConflict: 'job_id' });
                
                if (error) throw error;
                
                plInserted += chunk.length;
                const percent = Math.min(95, 90 + Math.round((plInserted / allPLData.length) * 10));
                const elapsed = Math.round((Date.now() - startTime) / 1000);
                showUploadProgress(`📊 ${plInserted}/${allPLData.length} PL records (${elapsed}s)`, percent);
            }
            
            const totalTime = Math.round((Date.now() - startTime) / 1000);
            
            // Update upload status
            updateUploadStatus('qasem');
            
            const summary = `
✅ BULK UPLOAD COMPLETE!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 Jobs uploaded:  ${totalToProcess}
📋 PL records:     ${allPLData.length}
⏭️  Complete skipped: ${skippedComplete}
⏱️  Time:            ${totalTime} seconds
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`;
            console.log(summary);
            
            showUploadProgress(`✅ ${totalToProcess} jobs uploaded in ${totalTime}s!`, 100);
            
            // Refresh UI
            setTimeout(async () => {
                await supabaseSyncAllData();
                populateProductionFeed();
                hideUploadProgress();
                showNotification(
                    `✅ ${totalToProcess} jobs uploaded (${skippedComplete} complete jobs skipped) in ${totalTime}s`,
                    'success'
                );
                updateStatistics();
            }, 500);
            
        } catch (error) {
            console.error('❌ Upload failed:', error);
            hideUploadProgress();
            alert('❌ Upload failed: ' + error.message);
        }
    };
    
    reader.readAsArrayBuffer(file);
}

// ============================================================
// EXCEL UPLOAD SETUP
// ============================================================
function setupExcelUploads() {
    console.log('Setting up Excel uploads...');
    
    // AW Upload
    const uploadBtnAW = document.getElementById('upload-excel-aw');
    const fileInputAW = document.getElementById('file-input-aw');
    
    if (uploadBtnAW && fileInputAW) {
        console.log('AW upload elements found');
        
        const newBtn = uploadBtnAW.cloneNode(true);
        uploadBtnAW.parentNode.replaceChild(newBtn, uploadBtnAW);
        
        newBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            console.log('AW Upload button clicked - triggering file input');
            fileInputAW.click();
        });
        
        fileInputAW.addEventListener('change', function(e) {
            const file = this.files[0];
            if (file) {
                console.log('AW file selected:', file.name);
                handleAWUpload(file);
            } else {
                console.log('No AW file selected');
            }
            this.value = '';
        });
        
        document.addEventListener('dragover', function(e) {
            e.preventDefault();
        });
        
        document.addEventListener('drop', function(e) {
            e.preventDefault();
        });
    } else {
        console.warn('AW upload elements not found:', 
            'button:', !!uploadBtnAW, 
            'input:', !!fileInputAW);
    }
    
    // PL Upload - Using BULK version (SUPER FAST)
    const uploadBtnPL = document.getElementById('upload-excel-pl');
    const fileInputPL = document.getElementById('file-input-pl');
    
    if (uploadBtnPL && fileInputPL) {
        console.log('PL upload elements found');
        
        const newBtn = uploadBtnPL.cloneNode(true);
        uploadBtnPL.parentNode.replaceChild(newBtn, uploadBtnPL);
        
        // Add visual indicator that it's fast
        newBtn.innerHTML = '<i class="fas fa-file-excel"></i> PL ⚡';
        
        newBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            console.log('PL Upload button clicked - triggering file input');
            fileInputPL.click();
        });
        
        fileInputPL.addEventListener('change', function(e) {
            const file = this.files[0];
            if (file) {
                console.log('PL file selected:', file.name);
                showUploadProgress('⏳ Processing file...', 5);
                bulkPLUpload(file);  // ← BULK UPLOAD - SUPER FAST!
            } else {
                console.log('No PL file selected');
            }
            this.value = '';
        });
    } else {
        console.warn('PL upload elements not found:', 
            'button:', !!uploadBtnPL, 
            'input:', !!fileInputPL);
    }
}

// ============================================================
// HANDLE AW UPLOAD - UPDATED WITH SUPABASE SAVE
// ============================================================
function handleAWUpload(file) {
    console.log('Uploading AW Excel file:', file.name);
    
    showUploadProgress('Reading AW file...', 10);
    
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
            
            showUploadProgress('Processing AW data...', 50);
            
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
                console.log(`📌 ${completeJobNumbers.size} COMPLETE jobs (AW will skip these)`);
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
                
                console.log(`Processing AW job: ${jobNumber}, status: "${status}"`);
                
                let statusDate = null;
                
                const statusDateMap = {
                    '1. Under Job-Study': { index: 32, label: 'AG' },
                    '2. Under QC Check': { index: 34, label: 'AI' },
                    '3. S.C Approval': { index: 36, label: 'AK' },
                    '4. Need S.C Approval': { index: 38, label: 'AM' },
                    '5. Working on Cromalin': { index: 40, label: 'AO' },
                    '6. Need Cromalin Approval': { index: 42, label: 'AQ' },
                    '7. Cromalin Approval': { index: 44, label: 'AS' },
                    '8. Repro: Plate Making': { index: 46, label: 'AU' },
                    '9. Plates are Ready': { index: 48, label: 'AW' }
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
                    console.log(`Found matching job: ${jobId} - updating AW status only`);
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
                    console.log(`No matching job found for ${jobNumber} - skipping AW-only creation`);
                    awJobsSkipped++;
                }
            }
            
            console.log(`AW upload results: ${awJobsFound} updated, ${awJobsSkipped} skipped (complete jobs)`);
            
            // Save to Supabase
            try {
                if (Object.keys(awDataToSave).length > 0) {
                    await supabaseSaveMultipleAWData(awDataToSave);
                    console.log(`✅ ${Object.keys(awDataToSave).length} AW records saved to Supabase`);
                }
                
                if (Object.keys(jobsToUpdate).length > 0) {
                    await supabaseSaveMultipleJobs(jobsToUpdate);
                    console.log(`✅ ${Object.keys(jobsToUpdate).length} jobs updated in Supabase`);
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
                if (detected.mahmoud) {
                    updateUploadStatus('mahmoud');
                }
                if (detected.raed) {
                    updateUploadStatus('raed');
                }
                if (detected.rabia) {
                    updateUploadStatus('rabia');
                }
                showNotification(`✅ AW data uploaded - ${awJobsFound} jobs updated`, 'success');
            }
            
            showUploadProgress(`AW upload complete: ${awJobsFound} updated, ${awJobsSkipped} skipped`, 100);
            
            setTimeout(() => {
                hideUploadProgress();
                console.log('AW upload completed successfully');
            }, 1500);
            
        } catch (error) {
            console.error('Error processing AW file:', error);
            showUploadProgress('Error processing AW file', 100);
            setTimeout(() => hideUploadProgress(), 3000);
            alert('Error reading AW Excel file. Please check the file format.\nError: ' + error.message);
        }
    };
    
    reader.onerror = function() {
        console.error('Error reading AW file');
        showUploadProgress('Error reading file', 100);
        setTimeout(() => hideUploadProgress(), 3000);
        alert('Error reading file. Please try again.');
    };
    
    reader.readAsArrayBuffer(file);
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
window.bulkPLUpload = bulkPLUpload;
window.findJobIdByNumber = findJobIdByNumber;
window.calculateEstimatedDate = calculateEstimatedDate;

console.log('✅ Upload status tracking initialized');
