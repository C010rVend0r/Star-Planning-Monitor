// script-upload.js - Add status tracking system
// ============================================================
// UPLOAD STATUS TRACKING
// ============================================================

// Upload status tracking
const uploadStatus = {
    mahmoud: { lastUpdated: null, status: 'pending' },
    raed: { lastUpdated: null, status: 'pending' },
    rabia: { lastUpdated: null, status: 'pending' },
    qasem: { lastUpdated: null, status: 'pending' }
};

const UPLOAD_VALIDITY_MINUTES = 1; // 1 minute for testing, change to 1440 for 24 hours
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
        // Check if it's Friday (getDay() returns 5 for Friday)
        if (result.getDay() !== 5) {
            daysAdded++;
        }
        // If it's Friday, skip it (don't count it)
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
    
    // Check for Full Data first
    if (lowerSheetNames.some(name => 
        SHEET_PATTERNS.fullData.some(pattern => name.includes(pattern))
    )) {
        results.fullData = true;
        results.mahmoud = true;
        results.raed = true;
        results.rabia = true;
        return results;
    }
    
    // Check individual sheets
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
// UPDATE STATUS INDICATORS - FIXED
// ============================================================
// ============================================================
// UPDATE STATUS INDICATORS - SIMPLIFIED
// ============================================================

function updateStatusIndicators(allUpdated = null) {
    // Find the upload status container
    let statusContainer = document.getElementById('upload-status-container');
    
    // If it doesn't exist, create it after the header
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
    
    // Check if all are updated
    const isAllUpdated = statusConfigs.every(c => uploadStatus[c.key].status === 'updated');
    
    // If all updated, show celebration message
    if (isAllUpdated) {
        statusContainer.innerHTML = `
            <div class="upload-status-item status-all-updated">
                <span>✅ All Data are updated !!</span>
            </div>
        `;
        return;
    }
    
    // Otherwise, show only the people who need to update
    let statusHTML = '';
    let pendingCount = 0;
    let pendingNames = [];
    
    for (const config of statusConfigs) {
        const status = uploadStatus[config.key];
        
        // Only show if NOT updated (pending or expired)
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
    
    // Add overall summary
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
    // Find the stat card with "Real Time" label
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
        // Try fallback: find by index (third stat card)
        if (statCards.length >= 3) {
            realTimeCard = statCards[2];
        } else {
            console.warn('Real Time stat card not found');
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
// EXCEL UPLOAD SETUP
// ============================================================

function setupExcelUploads() {
    console.log('Setting up Excel uploads...');
    
    // AW Upload
    const uploadBtnAW = document.getElementById('upload-excel-aw');
    const fileInputAW = document.getElementById('file-input-aw');
    
    if (uploadBtnAW && fileInputAW) {
        console.log('AW upload elements found');
        
        // Remove any existing listeners by cloning
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
    
    // PL Upload
    const uploadBtnPL = document.getElementById('upload-excel-pl');
    const fileInputPL = document.getElementById('file-input-pl');
    
    if (uploadBtnPL && fileInputPL) {
        console.log('PL upload elements found');
        
        const newBtn = uploadBtnPL.cloneNode(true);
        uploadBtnPL.parentNode.replaceChild(newBtn, uploadBtnPL);
        
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
                handlePLUpload(file);
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
    
    reader.onload = async function(e) {  // ← ADDED async
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
            
            // CRITICAL: Save current filter state
            const savedFilterStatuses = new Set(filterStatuses);
            
            // Track jobs to save to Supabase
            const jobsToUpdate = {};
            const awDataToSave = {};
            
            rows.forEach((row, index) => {
                if (!row || row.length < 10) {
                    return;
                }
                
                const jobNumber = String(row[5] || '').trim();
                const status = String(row[8] || '').trim();
                
                if (!jobNumber) {
                    return;
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
                
                // Store AW data in memory
                awData[jobNumber] = {
                    status: rawStatus,
                    rawStatus: rawStatus,
                    statusDate: statusDate.toISOString(),
                    estimatedDate: estimatedDate ? estimatedDate.toISOString() : null,
                    isFromAW: true
                };
                
                // Save AW data to Supabase
                awDataToSave[jobNumber] = {
                    status: rawStatus,
                    raw_status: rawStatus,
                    status_date: statusDate.toISOString(),
                    estimated_date: estimatedDate ? estimatedDate.toISOString() : null,
                    is_from_aw: true
                };
                
                // Find existing job by job number
                let jobId = findJobIdByNumber(jobNumber);
                
                if (jobId) {
                    // Job exists - update AW status
                    console.log(`Found matching job: ${jobId} - updating AW status only`);
                    if (jobDatabase[jobId]) {
                        jobDatabase[jobId].awStatus = rawStatus;
                        jobDatabase[jobId].status = rawStatus;
                        jobDatabase[jobId].statusDate = statusDate.toISOString();
                        jobDatabase[jobId].rawAWStatus = rawStatus;
                        jobDatabase[jobId].estimatedDate = estimatedDate ? estimatedDate.toISOString() : null;
                        
                        // Track for Supabase save
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
                    // Job does NOT exist in PL - SKIP creating it
                    console.log(`No matching job found for ${jobNumber} - skipping AW-only creation`);
                    awJobsSkipped++;
                }
            });
            
            console.log(`AW upload results: ${awJobsFound} updated, ${awJobsSkipped} skipped`);
            
            // ============================================================
            // ✅ SAVE TO SUPABASE
            // ============================================================
            try {
                // Save AW data
                if (Object.keys(awDataToSave).length > 0) {
                    await supabaseSaveMultipleAWData(awDataToSave);
                    console.log(`✅ ${Object.keys(awDataToSave).length} AW records saved to Supabase`);
                }
                
                // Save job updates
                if (Object.keys(jobsToUpdate).length > 0) {
                    await supabaseSaveMultipleJobs(jobsToUpdate);
                    console.log(`✅ ${Object.keys(jobsToUpdate).length} jobs updated in Supabase`);
                }
            } catch (saveError) {
                console.error('❌ Error saving to Supabase:', saveError);
            }
            
            // RESTORE filter state
            filterStatuses = savedFilterStatuses;
            
            // Refresh the feed
            populateProductionFeed();
            
            // Apply filters
            applyFilter();
            updateFilterCounts();
            updateStatistics();
            updateFilterBadge();
            syncFilterCheckboxes();
            
            if (detected.fullData) {
                updateUploadStatus('mahmoud');
                updateUploadStatus('raed');
                updateUploadStatus('rabia');
                showNotification(`✅ Full Data uploaded - ${awJobsFound} updated, ${awJobsSkipped} skipped`, 'success');
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
// HANDLE PL UPLOAD - UPDATED WITH SUPABASE SAVE
// ============================================================

function handlePLUpload(file) {
    console.log('Uploading PL Excel file:', file.name);
    
    showUploadProgress('Reading PL file...', 10);
    
    const reader = new FileReader();
    
    reader.onload = async function(e) {  // ← ADDED async
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
                showUploadProgress('Sheet "PLAN-WEEK" not found', 100);
                setTimeout(() => hideUploadProgress(), 3000);
                alert('Sheet "PLAN-WEEK" not found in the uploaded file.');
                return;
            }
            
            const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 });
            
            console.log('PL data rows:', jsonData.length);
            
            showUploadProgress('Processing PL data...', 30);
            
            const rows = jsonData.slice(1);
            let jobsAdded = 0;
            let jobsWithAW = 0;
            
            // SAVE existing AW data before clearing
            const savedAWData = { ...awData };
            console.log('Saved AW data keys:', Object.keys(savedAWData));
            
            // Clear existing databases but keep AW data reference
            Object.keys(jobDatabase).forEach(key => delete jobDatabase[key]);
            Object.keys(plDatabase).forEach(key => delete plDatabase[key]);
            
            // Track data to save to Supabase
            const jobsToSave = {};
            const plDataToSave = {};
            
            rows.forEach((row, index) => {
                if (!row || row.length < 25) {
                    console.log(`Row ${index + 2} has insufficient data, skipping`);
                    return;
                }
                
                const jobNumber = String(row[0] || '').trim();
                const jobName = String(row[1] || '').trim();
                const newPlat = String(row[2] || '').trim();
                const materialAvailability = String(row[4] || '').trim();
                const planningStatus = String(row[5] || '').trim();
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
                
                if (!jobNumber) {
                    console.log(`Row ${index + 2} has no job number, skipping`);
                    return;
                }
                
                console.log(`Processing PL job: ${jobNumber}, planningStatus: "${planningStatus}"`);
                
                // Check if we have AW data for this job (from savedAWData)
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
                    console.log(`Found AW data for ${jobNumber}: ${awStatus}`);
                } else {
                    console.log(`No AW data found for ${jobNumber} - setting AW status to "Unknown"`);
                }
                
                const isPlanned = planningStatus === 'Planned';
                const isComplete = planningStatus === 'Complete' || planningStatus === 'Printed';
                const isUnplanned = planningStatus === 'Unplanned';
                const isDeleted = planningStatus === 'Deleted' || planningStatus === 'PL-Deleted';
                const isHold = planningStatus === 'Hold' || planningStatus === 'PL-Hold';
                
                const jobId = 'job-' + (Object.keys(jobDatabase).length + 1);
                
                let effectiveStatus = awStatus;
                if (isComplete) effectiveStatus = 'Complete';
                else if (isPlanned) effectiveStatus = 'Planned';
                else if (isUnplanned) effectiveStatus = 'Unplanned';
                else if (isDeleted) effectiveStatus = 'PL-Deleted';
                else if (isHold) effectiveStatus = 'PL-Hold';
                // If no AW status, keep the PL status as the main status
                if (awStatus === 'Unknown' && !isComplete && !isPlanned && !isUnplanned && !isDeleted && !isHold) {
                    effectiveStatus = planningStatus || 'Unplanned';
                }
                
                jobDatabase[jobId] = {
                    name: jobName || 'Unnamed Job',
                    jobNumber: jobNumber,
                    status: effectiveStatus,
                    awStatus: awStatus,
                    rawAWStatus: awStatus,
                    planningStatus: planningStatus || 'Unplanned',
                    statusDate: statusDate.toISOString(),
                    estimatedDate: estimatedDate ? estimatedDate.toISOString() : null,
                    setup: setupTime || plannedSetup || 120,
                    quantity: meters || quantity || 0,
                    isComplete: isComplete,
                    isPlanned: isPlanned,
                    isUnplanned: isUnplanned,
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
                    planningStatus: planningStatus || 'Unplanned',
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
                    isUnplanned: isUnplanned,
                    isDeleted: isDeleted,
                    isHold: isHold,
                    statusDate: statusDate.toISOString(),
                    estimatedDate: estimatedDate ? estimatedDate.toISOString() : null
                };
                
                // Track for Supabase save
                const jobDataForDB = {
                    job_id: jobId,
                    job_number: jobNumber,
                    name: jobName || 'Unnamed Job',
                    status: effectiveStatus,
                    aw_status: awStatus,
                    raw_aw_status: awStatus,
                    planning_status: planningStatus || 'Unplanned',
                    status_date: statusDate.toISOString(),
                    estimated_date: estimatedDate ? estimatedDate.toISOString() : null,
                    setup: setupTime || plannedSetup || 120,
                    quantity: meters || quantity || 0,
                    is_complete: isComplete,
                    is_planned: isPlanned,
                    is_unplanned: isUnplanned,
                    is_deleted: isDeleted,
                    is_hold: isHold,
                    new_plat: newPlat,
                    material_availability: materialAvailability,
                    delivered: delivered,
                    delivered2: delivered2,
                    machine: machine,
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
                jobsToSave[jobId] = jobDataForDB;
                
                const plDataForDB = {
                    job_id: jobId,
                    job_number: jobNumber,
                    job_name: jobName || 'Unnamed Job',
                    new_plat: newPlat,
                    prepress_status: awStatus || 'Unknown',
                    material_availability: materialAvailability,
                    planning_status: planningStatus || 'Unplanned',
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
                    is_planned: isPlanned,
                    is_unplanned: isUnplanned,
                    is_deleted: isDeleted,
                    is_hold: isHold,
                    status_date: statusDate.toISOString(),
                    estimated_date: estimatedDate ? estimatedDate.toISOString() : null
                };
                plDataToSave[jobId] = plDataForDB;
                
                jobsAdded++;
            });
            
            console.log(`Added ${jobsAdded} jobs to database, ${jobsWithAW} have AW data`);
            
            // ============================================================
            // ✅ SAVE TO SUPABASE
            // ============================================================
            try {
                // Save jobs
                if (Object.keys(jobsToSave).length > 0) {
                    await supabaseSaveMultipleJobs(jobsToSave);
                    console.log(`✅ ${Object.keys(jobsToSave).length} jobs saved to Supabase`);
                }
                
                // Save PL data
                for (const [jobId, data] of Object.entries(plDataToSave)) {
                    await supabaseSavePLData(jobId, data);
                }
                console.log(`✅ ${Object.keys(plDataToSave).length} PL records saved to Supabase`);
                
            } catch (saveError) {
                console.error('❌ Error saving to Supabase:', saveError);
            }
            
            // Populate the feed
            populateProductionFeed();
            
            // Add jobs to timeline if they're Planned
            let timelineJobsAdded = 0;
            
            for (const [jobId, jobData] of Object.entries(jobDatabase)) {
                const machine = jobData.machine;
                const planningStatus = jobData.planningStatus;
                const isPlanned = planningStatus === 'Planned';
                
                const existingJob = document.querySelector(`.job[data-job-id="${jobId}"]`);
                
                if (machine && machineIdMap[machine] && isPlanned && !existingJob) {
                    const machineId = machineIdMap[machine];
                    const timelineId = `timeline-${machineId}`;
                    const timeline = document.getElementById(timelineId);
                    
                    if (timeline) {
                        const now = new Date().getTime();
                        addJobToTimelineWithSchedule(jobId, timelineId, now);
                        timelineJobsAdded++;
                        console.log(`Added ${jobId} to ${timelineId} (Planned status)`);
                    }
                } else if (existingJob && !isPlanned && !existingJob.classList.contains('job-printed')) {
                    returnJobToFeed(existingJob);
                    console.log(`Removed ${jobId} from timeline (status: ${planningStatus})`);
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
            showNotification(`✅ PL uploaded: ${jobsAdded} jobs (${jobsWithAW} with AW data)`, 'success');
            
            showUploadProgress(`PL upload complete: ${jobsAdded} jobs, ${timelineJobsAdded} on timeline`, 100);
            
            setTimeout(() => {
                hideUploadProgress();
                updateStatistics();
                applySmartZoom();
                setTimeout(() => updateAllTimelineScrollPositions(), 300);
                console.log('PL upload completed successfully');
            }, 1500);
            
        } catch (error) {
            console.error('Error processing PL file:', error);
            showUploadProgress('Error processing PL file', 100);
            setTimeout(() => hideUploadProgress(), 3000);
            alert('Error reading PL Excel file. Please check the file format.\nError: ' + error.message);
        }
    };
    
    reader.onerror = function() {
        console.error('Error reading PL file');
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
    // Initial check - update indicators immediately
    checkUploadValidity();
    
    // Also force an immediate update of the indicators
    setTimeout(function() {
        updateStatusIndicators();
    }, 100);
    
    // Check every 30 seconds
    if (statusCheckInterval) {
        clearInterval(statusCheckInterval);
    }
    statusCheckInterval = setInterval(checkUploadValidity, 30000);
    
    console.log(`📊 Upload status monitoring started (validity: ${UPLOAD_VALIDITY_MINUTES} minute${UPLOAD_VALIDITY_MINUTES > 1 ? 's' : ''})`);
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
