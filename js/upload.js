// script-upload.js - TRUE BULK UPLOAD (SUPER FAST)
// ============================================================
// UPLOAD STATUS TRACKING
// ============================================================

const uploadStatus = {
    mahmoud: { lastUpdated: null, status: 'pending' },
    raed: { lastUpdated: null, status: 'pending' },
    rabia: { lastUpdated: null, status: 'pending' },
    qasem: { lastUpdated: null, status: 'pending' }
};

const UPLOAD_VALIDITY_MINUTES = 1440;
let statusCheckInterval = null;

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
    if (!startDate || isNaN(startDate.getTime())) return null;
    const result = new Date(startDate);
    let daysAdded = 0;
    while (daysAdded < daysToAdd) {
        result.setDate(result.getDate() + 1);
        if (result.getDay() !== 5) daysAdded++;
    }
    return result;
}

// ============================================================
// DETECT UPLOADER
// ============================================================
function detectUploader(sheetNames) {
    const results = { mahmoud: false, raed: false, rabia: false, fullData: false };
    const lowerSheetNames = sheetNames.map(name => name.toLowerCase().trim());
    
    if (lowerSheetNames.some(name => SHEET_PATTERNS.fullData.some(pattern => name.includes(pattern)))) {
        results.fullData = true;
        results.mahmoud = true;
        results.raed = true;
        results.rabia = true;
        return results;
    }
    
    if (lowerSheetNames.some(name => SHEET_PATTERNS.mahmoud.some(pattern => name.includes(pattern)))) results.mahmoud = true;
    if (lowerSheetNames.some(name => SHEET_PATTERNS.raed.some(pattern => name.includes(pattern)))) results.raed = true;
    if (lowerSheetNames.some(name => SHEET_PATTERNS.rabia.some(pattern => name.includes(pattern)))) results.rabia = true;
    
    return results;
}

function updateUploadStatus(uploader) {
    const now = new Date();
    uploadStatus[uploader].lastUpdated = now;
    uploadStatus[uploader].status = 'updated';
    updateStatusIndicators();
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
        statusContainer.innerHTML = `<div class="upload-status-item status-all-updated"><span>✅ All Data are updated !!</span></div>`;
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
        if (statCards.length >= 3) realTimeCard = statCards[2];
        else return;
    }
    const statValue = realTimeCard.querySelector('.stat-value');
    if (!statValue) return;
    const now = new Date();
    statValue.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
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
// TIMELINE ID HELPER
// ============================================================
function getTimelineId(machine) {
    if (!machine) return null;
    const m = String(machine).trim();
    const map = {
        '7': '207',
        '8': '208',
        '10': '210',
        '11': '211'
    };
    if (['207', '208', '210', '211'].includes(m)) {
        return `timeline-${m}`;
    }
    if (map[m]) {
        return `timeline-${map[m]}`;
    }
    const possibleId = `timeline-${m}`;
    if (document.getElementById(possibleId)) {
        return possibleId;
    }
    return null;
}

// ============================================================
// EXCEL UPLOAD SETUP
// ============================================================
function setupExcelUploads() {
    console.log('Setting up Excel uploads...');
    
    const uploadBtnAW = document.getElementById('upload-excel-aw');
    const fileInputAW = document.getElementById('file-input-aw');
    
    if (uploadBtnAW && fileInputAW) {
        const newBtn = uploadBtnAW.cloneNode(true);
        uploadBtnAW.parentNode.replaceChild(newBtn, uploadBtnAW);
        newBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            fileInputAW.click();
        });
        fileInputAW.addEventListener('change', function(e) {
            const file = this.files[0];
            if (file) {
                handleAWUpload(file);
            }
            this.value = '';
        });
    }
    
    const uploadBtnPL = document.getElementById('upload-excel-pl');
    const fileInputPL = document.getElementById('file-input-pl');
    
    if (uploadBtnPL && fileInputPL) {
        const newBtn = uploadBtnPL.cloneNode(true);
        uploadBtnPL.parentNode.replaceChild(newBtn, uploadBtnPL);
        newBtn.innerHTML = '<i class="fas fa-file-excel"></i> PL ⚡';
        
        newBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            fileInputPL.click();
        });
        
        fileInputPL.addEventListener('change', function(e) {
            const file = this.files[0];
            if (file) {
                handlePLUpload(file);
            }
            this.value = '';
        });
    }
}

// ============================================================
// HANDLE AW UPLOAD
// ============================================================
function handleAWUpload(file) {
    console.log('Uploading AW Excel file:', file.name);
    showUploadProgress('Reading AW file...', 10);
    
    const reader = new FileReader();
    
    reader.onload = function(e) {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            
            const sheetNames = workbook.SheetNames;
            const detected = detectUploader(sheetNames);
            const firstSheet = workbook.Sheets[sheetNames[0]];
            const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });
            
            showUploadProgress('Processing AW data...', 50);
            const rows = jsonData.slice(3);
            let awJobsFound = 0;
            let awJobsSkipped = 0;
            const savedFilterStatuses = new Set(filterStatuses);
            
            rows.forEach((row) => {
                if (!row || row.length < 10) return;
                const jobNumber = String(row[5] || '').trim();
                const status = String(row[8] || '').trim();
                if (!jobNumber) return;
                
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
                            if (!isNaN(jsDate.getTime())) statusDate = jsDate;
                        } else if (typeof dateValue === 'string') {
                            const parsed = new Date(dateValue);
                            if (!isNaN(parsed.getTime()) && parsed.getFullYear() > 1900) statusDate = parsed;
                        }
                    }
                }
                if (!statusDate) statusDate = new Date(1900, 0, 1);
                
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
                
                let jobId = findJobIdByNumber(jobNumber);
                if (jobId) {
                    if (jobDatabase[jobId]) {
                        jobDatabase[jobId].awStatus = rawStatus;
                        jobDatabase[jobId].status = rawStatus;
                        jobDatabase[jobId].statusDate = statusDate.toISOString();
                        jobDatabase[jobId].rawAWStatus = rawStatus;
                        jobDatabase[jobId].estimatedDate = estimatedDate ? estimatedDate.toISOString() : null;
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
            });
            
            filterStatuses = savedFilterStatuses;
            
            // Save AW data to Supabase in bulk
            try {
                const awDataToSave = {};
                for (const [jobNumber, data] of Object.entries(awData)) {
                    if (data.isFromAW) {
                        awDataToSave[jobNumber] = {
                            status: data.status,
                            raw_status: data.rawStatus,
                            status_date: data.statusDate,
                            estimated_date: data.estimatedDate || null,
                            is_from_aw: true
                        };
                    }
                }
                if (Object.keys(awDataToSave).length > 0) {
                    supabaseSaveMultipleAWData(awDataToSave);
                }
            } catch (e) {}
            
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
                showNotification(`✅ Full Data uploaded - ${awJobsFound} updated`, 'success');
            } else {
                if (detected.mahmoud) updateUploadStatus('mahmoud');
                if (detected.raed) updateUploadStatus('raed');
                if (detected.rabia) updateUploadStatus('rabia');
                showNotification(`✅ AW data uploaded - ${awJobsFound} jobs updated`, 'success');
            }
            
            showUploadProgress(`AW upload complete: ${awJobsFound} updated`, 100);
            setTimeout(() => hideUploadProgress(), 1500);
            
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
// HANDLE PL UPLOAD - TRUE BULK (SUPER FAST)
// ============================================================
async function handlePLUpload(file) {
    console.log('⚡ BULK PL UPLOAD STARTED:', file.name);
    showUploadProgress('📖 Reading file...', 10);
    
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
                alert('❌ Sheet "PLAN-WEEK" not found!');
                hideUploadProgress();
                return;
            }
            
            const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 });
            const rows = jsonData.slice(1);
            
            console.log(`📊 Processing ${rows.length} rows...`);
            showUploadProgress(`📊 Processing ${rows.length} rows...`, 20);
            
            // Build ALL data in arrays for bulk insert
            const jobsToSave = [];
            const plToSave = [];
            const savedAWData = { ...awData };
            let jobsAdded = 0;
            let jobsWithAW = 0;
            
            // Clear memory databases
            Object.keys(jobDatabase).forEach(key => delete jobDatabase[key]);
            Object.keys(plDatabase).forEach(key => delete plDatabase[key]);
            
            // Process all rows
            for (const row of rows) {
                if (!row || row.length < 25) continue;
                
                const jobNumber = String(row[0] || '').trim();
                if (!jobNumber) continue;
                
                const jobName = String(row[1] || '').trim() || 'Unnamed Job';
                const newPlat = String(row[2] || '').trim() || '';
                const materialAvailability = String(row[4] || '').trim() || '';
                const planningStatus = String(row[5] || '').trim() || 'Unprinted';
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
                
                // Check AW data
                let awStatus = 'Unknown';
                let statusDate = new Date(1900, 0, 1);
                let estimatedDate = null;
                
                if (savedAWData[jobNumber]) {
                    awStatus = savedAWData[jobNumber].status || 'Unknown';
                    if (savedAWData[jobNumber].statusDate) {
                        const parsedDate = new Date(savedAWData[jobNumber].statusDate);
                        if (!isNaN(parsedDate.getTime()) && parsedDate.getFullYear() > 1900) {
                            statusDate = parsedDate;
                        }
                    }
                    if (savedAWData[jobNumber].estimatedDate) {
                        const parsedDate = new Date(savedAWData[jobNumber].estimatedDate);
                        if (!isNaN(parsedDate.getTime()) && parsedDate.getFullYear() > 1900) {
                            estimatedDate = parsedDate;
                        }
                    }
                    jobsWithAW++;
                }
                
                const isPlanned = planningStatus === 'Planned';
                const isComplete = planningStatus === 'Complete' || planningStatus === 'Printed';
                const isUnprinted = planningStatus === 'Unprinted';
                const isDeleted = planningStatus === 'Deleted' || planningStatus === 'PL-Deleted';
                const isHold = planningStatus === 'Hold' || planningStatus === 'PL-Hold';
                
                const jobId = `job-${jobNumber}`;
                
                let effectiveStatus = awStatus;
                if (isComplete) effectiveStatus = 'Complete';
                else if (isPlanned) effectiveStatus = 'Planned';
                else if (isUnprinted) effectiveStatus = 'Unprinted';
                else if (isDeleted) effectiveStatus = 'PL-Deleted';
                else if (isHold) effectiveStatus = 'PL-Hold';
                else if (awStatus === 'Unknown') {
                    effectiveStatus = planningStatus || 'Unprinted';
                }
                
                // Store in memory
                jobDatabase[jobId] = {
                    name: jobName,
                    jobNumber: jobNumber,
                    status: effectiveStatus,
                    awStatus: awStatus,
                    rawAWStatus: awStatus,
                    planningStatus: planningStatus || 'Unprinted',
                    statusDate: statusDate.toISOString(),
                    estimatedDate: estimatedDate ? estimatedDate.toISOString() : null,
                    setup: setupTime || plannedSetup || 120,
                    quantity: meters || quantity || 0,
                    isComplete: isComplete,
                    isPlanned: isPlanned,
                    isUnprinted: isUnprinted,
                    isDeleted: isDeleted,
                    isHold: isHold,
                    newPlat: newPlat,
                    materialAvailability: materialAvailability,
                    delivered: delivered,
                    delivered2: delivered2,
                    machine: machine,
                    cuttingMethod: cuttingMethod,
                    film: film,
                    thickness: thickness,
                    materialType: materialType,
                    machineSpeed: machineSpeed,
                    meters: meters,
                    setupTime: setupTime,
                    requiredTime: requiredTime,
                    plannedSpeed: plannedSpeed,
                    actualSpeed: actualSpeed,
                    plannedSetup: plannedSetup,
                    actualSetup: actualSetup,
                    downtime: downtime,
                    printingDuration: printingDuration
                };
                
                plDatabase[jobId] = {
                    jobNumber: jobNumber,
                    jobName: jobName,
                    newPlat: newPlat,
                    prepressStatus: awStatus || 'Unknown',
                    materialAvailability: materialAvailability,
                    planningStatus: planningStatus || 'Unprinted',
                    delivered: delivered,
                    delivered2: delivered2,
                    machine: machine,
                    cuttingMethod: cuttingMethod,
                    quantity: quantity,
                    film: film,
                    thickness: thickness,
                    materialType: materialType,
                    machineSpeed: machineSpeed,
                    meters: meters,
                    setupTime: setupTime,
                    requiredTime: requiredTime,
                    plannedSpeed: plannedSpeed,
                    actualSpeed: actualSpeed,
                    plannedSetup: plannedSetup,
                    actualSetup: actualSetup,
                    downtime: downtime,
                    printingDuration: printingDuration,
                    isComplete: isComplete,
                    isPlanned: isPlanned,
                    isUnprinted: isUnprinted,
                    isDeleted: isDeleted,
                    isHold: isHold,
                    statusDate: statusDate.toISOString(),
                    estimatedDate: estimatedDate ? estimatedDate.toISOString() : null
                };
                
                // Add to bulk arrays - ONLY columns that exist in your DB
                jobsToSave.push({
                    job_id: jobId,
                    job_number: jobNumber,
                    name: jobName,
                    status: effectiveStatus,
                    aw_status: awStatus,
                    raw_aw_status: awStatus,
                    planning_status: planningStatus || 'Unprinted',
                    status_date: statusDate.toISOString(),
                    estimated_date: estimatedDate ? estimatedDate.toISOString() : null,
                    setup: setupTime || plannedSetup || 120,
                    quantity: meters || quantity || 0,
                    machine: machine || '',
                    is_complete: isComplete || false,
                    is_planned: isPlanned || false,
                    is_unplanned: isUnprinted || false,
                    is_deleted: isDeleted || false,
                    is_hold: isHold || false,
                    new_plat: newPlat || '',
                    material_availability: materialAvailability || '',
                    delivered: delivered || '',
                    delivered2: delivered2 || '',
                    cutting_method: cuttingMethod || '',
                    film: film || '',
                    thickness: thickness || '',
                    material_type: materialType || '',
                    machine_speed: machineSpeed || 200,
                    meters: meters || 0,
                    setup_time: setupTime || 120,
                    required_time: requiredTime || 0,
                    planned_speed: plannedSpeed || 200,
                    actual_speed: actualSpeed || 200,
                    planned_setup: plannedSetup || 120,
                    actual_setup: actualSetup || 0,
                    downtime: downtime || 0,
                    printing_duration: printingDuration || 0
                });
                
                plToSave.push({
                    job_id: jobId,
                    job_number: jobNumber,
                    job_name: jobName,
                    new_plat: newPlat || '',
                    prepress_status: awStatus || 'Unknown',
                    material_availability: materialAvailability || '',
                    planning_status: planningStatus || 'Unprinted',
                    delivered: delivered || '',
                    delivered2: delivered2 || '',
                    machine: machine || '',
                    cutting_method: cuttingMethod || '',
                    quantity: quantity || 0,
                    film: film || '',
                    thickness: thickness || '',
                    material_type: materialType || '',
                    machine_speed: machineSpeed || 200,
                    meters: meters || 0,
                    setup_time: setupTime || 120,
                    required_time: requiredTime || 0,
                    planned_speed: plannedSpeed || 200,
                    actual_speed: actualSpeed || 200,
                    planned_setup: plannedSetup || 120,
                    actual_setup: actualSetup || 0,
                    downtime: downtime || 0,
                    printing_duration: printingDuration || 0,
                    is_complete: isComplete || false,
                    is_planned: isPlanned || false,
                    is_unplanned: isUnprinted || false,
                    is_deleted: isDeleted || false,
                    is_hold: isHold || false,
                    status_date: statusDate.toISOString(),
                    estimated_date: estimatedDate || null
                });
                
                jobsAdded++;
            }
            
            console.log(`✅ ${jobsAdded} jobs prepared (${jobsWithAW} with AW data)`);
            
            // ============================================================
            // TRUE BULK UPLOAD - ALL IN ONE API CALL
            // ============================================================
            const client = initSupabase();
            const startTime = Date.now();
            
            showUploadProgress(`💾 Uploading ${jobsAdded} jobs...`, 40);
            
            // STEP 1: Delete existing data (fast)
            const existingJobs = await supabaseLoadAllJobs();
            if (existingJobs && existingJobs.length > 0) {
                for (let i = 0; i < existingJobs.length; i += 500) {
                    const batch = existingJobs.slice(i, i + 500);
                    const ids = batch.map(j => j.job_id);
                    await client.from('jobs').delete().in('job_id', ids);
                }
                console.log(`🗑️ Deleted ${existingJobs.length} existing jobs`);
            }
            
            const existingPL = await supabaseLoadAllPLData();
            if (existingPL && existingPL.length > 0) {
                for (let i = 0; i < existingPL.length; i += 500) {
                    const batch = existingPL.slice(i, i + 500);
                    const ids = batch.map(p => p.job_id);
                    await client.from('pl_database').delete().in('job_id', ids);
                }
                console.log(`🗑️ Deleted ${existingPL.length} existing PL records`);
            }
            
            // STEP 2: BULK INSERT - ALL JOBS IN ONE CALL (split into 500 per call for safety)
            const BATCH_SIZE = 500;
            let saved = 0;
            
            // Insert jobs in batches of 500
            for (let i = 0; i < jobsToSave.length; i += BATCH_SIZE) {
                const batch = jobsToSave.slice(i, i + BATCH_SIZE);
                const { error } = await client.from('jobs').insert(batch);
                if (error) {
                    console.warn('⚠️ Batch insert error, trying upsert:', error);
                    // If insert fails, try upsert
                    const { error: upsertError } = await client.from('jobs').upsert(batch, { onConflict: 'job_id' });
                    if (upsertError) console.error('❌ Upsert error:', upsertError);
                }
                saved += batch.length;
                const elapsed = Math.round((Date.now() - startTime) / 1000);
                const percent = Math.min(90, 40 + Math.round((saved / jobsToSave.length) * 50));
                showUploadProgress(`📊 ${saved}/${jobsToSave.length} jobs (${elapsed}s)`, percent);
                console.log(`✅ ${saved}/${jobsToSave.length} jobs inserted (${elapsed}s)`);
            }
            
            // Insert PL data in batches of 500
            for (let i = 0; i < plToSave.length; i += BATCH_SIZE) {
                const batch = plToSave.slice(i, i + BATCH_SIZE);
                const { error } = await client.from('pl_database').insert(batch);
                if (error) {
                    console.warn('⚠️ PL batch insert error:', error);
                    const { error: upsertError } = await client.from('pl_database').upsert(batch, { onConflict: 'job_id' });
                    if (upsertError) console.error('❌ PL upsert error:', upsertError);
                }
            }
            
            const totalTime = Math.round((Date.now() - startTime) / 1000);
            console.log(`✅ All ${saved} jobs saved in ${totalTime}s`);
            
            // ============================================================
            // RELOAD AND UPDATE UI
            // ============================================================
            showUploadProgress('🔄 Reloading data...', 96);
            await supabaseSyncAllData();
            
            // Clear existing timeline jobs
            document.querySelectorAll('.timeline').forEach(timeline => {
                const jobs = timeline.querySelectorAll('.job:not(.job-printed)');
                jobs.forEach(job => {
                    const jobId = job.getAttribute('data-job-id');
                    delete jobSchedule[jobId];
                    job.remove();
                });
            });
            
            // Add Planned jobs to timelines
            let timelineJobsAdded = 0;
            
            for (const [jobId, jobData] of Object.entries(jobDatabase)) {
                if (jobData.planningStatus !== 'Planned') continue;
                
                const machine = jobData.machine;
                const timelineId = getTimelineId(machine);
                
                if (timelineId) {
                    const timeline = document.getElementById(timelineId);
                    if (timeline) {
                        const existingJob = timeline.querySelector(`.job[data-job-id="${jobId}"]`);
                        if (!existingJob) {
                            const now = new Date().getTime();
                            addJobToTimelineWithSchedule(jobId, timelineId, now);
                            timelineJobsAdded++;
                        }
                    }
                }
            }
            
            // Update all timelines
            document.querySelectorAll('.timeline').forEach(timeline => {
                rescheduleTimelineJobs(timeline.id);
                scaleTimeline(timeline.id);
            });
            
            updateAllMachineStatuses();
            updateAllJobColors();
            updateAllJobTimes();
            updateAllNowIndicators();
            
            updateUploadStatus('qasem');
            
            showUploadProgress(`✅ ${jobsAdded} jobs uploaded in ${totalTime}s`, 100);
            
            setTimeout(() => {
                hideUploadProgress();
                populateProductionFeed();
                updateStatistics();
                applySmartZoom();
                setTimeout(() => updateAllTimelineScrollPositions(), 300);
                
                showNotification(
                    `✅ ${jobsAdded} jobs uploaded (${timelineJobsAdded} Planned on timeline) in ${totalTime}s`,
                    'success'
                );
                console.log('✅ PL upload completed successfully');
            }, 500);
            
        } catch (error) {
            console.error('❌ Upload failed:', error);
            hideUploadProgress();
            alert('❌ Upload failed: ' + error.message);
        }
    };
    
    reader.onerror = function() {
        console.error('❌ Error reading file');
        hideUploadProgress();
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
window.handlePLUpload = handlePLUpload;
window.findJobIdByNumber = findJobIdByNumber;
window.calculateEstimatedDate = calculateEstimatedDate;

console.log('✅ Upload status tracking initialized');
