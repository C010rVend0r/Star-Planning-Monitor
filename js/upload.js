// upload.js - COMPLETE REWRITE WITH OPTIMIZED TIMELINE HANDLING
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
    
    // 🔴 CRITICAL FIX: Save to Supabase so it persists across page reloads
    if (typeof supabaseUpdateUploadStatus === 'function') {
        supabaseUpdateUploadStatus(uploader, 'updated');
    }
    console.log(`✅ Upload status updated for ${uploader} at ${now.toLocaleTimeString()}`);
}

function checkUploadValidity() {
    const now = new Date();
    let allUpdated = true;
    let anyExpired = false;
    const statusChanges = [];
    
    for (const [key, value] of Object.entries(uploadStatus)) {
        if (value.lastUpdated === null) {
            value.status = 'pending';
            allUpdated = false;
            statusChanges.push(`${key}: pending (never updated)`);
        } else {
            const diffMinutes = (now - value.lastUpdated) / (1000 * 60);
            console.log(`📊 ${key}: ${diffMinutes.toFixed(1)} minutes since update (valid: ${UPLOAD_VALIDITY_MINUTES} minutes)`);
            
            if (diffMinutes > UPLOAD_VALIDITY_MINUTES) {
                value.status = 'expired';
                allUpdated = false;
                anyExpired = true;
                statusChanges.push(`${key}: expired (${diffMinutes.toFixed(0)} min)`);
            } else {
                value.status = 'updated';
                // Don't set allUpdated to false for updated items
            }
        }
    }
    
    if (statusChanges.length > 0) {
        console.log(`📊 Status changes: ${statusChanges.join(', ')}`);
    }
    
    // Show warning if any expired
    if (anyExpired) {
        const expiredNames = Object.entries(uploadStatus)
            .filter(([key, val]) => val.status === 'expired')
            .map(([key]) => key.charAt(0).toUpperCase() + key.slice(1))
            .join(', ');
        showNotification(`⚠️ Uploads from ${expiredNames} have expired (24h) - Please re-upload`, 'warning');
    }
    
    updateStatusIndicators(allUpdated);
    return allUpdated;
}

// ============================================================
// UPDATE STATUS INDICATORS - FIXED with better visual feedback
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
    
    // Check if all are updated
    const isAllUpdated = statusConfigs.every(c => uploadStatus[c.key].status === 'updated');
    if (isAllUpdated) {
        statusContainer.innerHTML = `
            <div class="upload-status-item status-all-updated" style="background: #d4edda; border-color: #28a745;">
                <span>✅ All data is up to date! (Last upload < 24h)</span>
            </div>
        `;
        return;
    }
    
    let statusHTML = '';
    let pendingCount = 0;
    let pendingNames = [];
    let expiredCount = 0;
    let expiredNames = [];
    
    for (const config of statusConfigs) {
        const status = uploadStatus[config.key];
        let statusClass = 'status-pending';
        let statusText = '⏳ Pending';
        let icon = '🔴';
        let timeInfo = '';
        
        if (status.status === 'expired') {
            statusText = '⚠️ EXPIRED';
            statusClass = 'status-expired';
            icon = '🔴';
            expiredCount++;
            expiredNames.push(config.label);
            if (status.lastUpdated) {
                const diffHours = (Date.now() - status.lastUpdated.getTime()) / (1000 * 60 * 60);
                timeInfo = ` (${diffHours.toFixed(0)}h ago)`;
            }
        } else if (status.status === 'pending') {
            statusText = '⏳ Pending';
            statusClass = 'status-pending';
            icon = '🟡';
            pendingCount++;
            pendingNames.push(config.label);
        } else if (status.status === 'updated') {
            // This shouldn't happen if isAllUpdated is false, but just in case
            statusText = '✅ Updated';
            statusClass = 'status-updated';
            icon = '✅';
        }
        
        statusHTML += `
            <div class="upload-status-item ${statusClass}">
                <span class="status-warning-icon">${icon}</span>
                <span class="status-label">${config.label}:</span>
                <span class="status-text">${statusText}${timeInfo}</span>
            </div>
        `;
    }
    
    let summaryHTML = '';
    if (expiredCount > 0) {
        summaryHTML = `
            <div class="upload-status-item status-expired-summary" style="background: #f8d7da; border-color: #dc3545; padding: 8px 12px; border-radius: 6px; margin-top: 4px;">
                <span>🔴 <strong>${expiredCount}</strong> upload${expiredCount > 1 ? 's' : ''} expired: <strong>${expiredNames.join(', ')}</strong> (must re-upload within 24h)</span>
            </div>
        `;
    } else if (pendingCount > 0) {
        summaryHTML = `
            <div class="upload-status-item status-pending-summary" style="background: #fff3cd; border-color: #ffc107; padding: 8px 12px; border-radius: 6px; margin-top: 4px;">
                <span>🟡 <strong>${pendingCount}</strong> upload${pendingCount > 1 ? 's' : ''} pending: <strong>${pendingNames.join(', ')}</strong></span>
            </div>
        `;
    }
    
    statusContainer.innerHTML = statusHTML + summaryHTML;
}
// ============================================================
// export BTN
// ============================================================
// ============================================================
// EXPORT PL DATA TO EXCEL
// ============================================================
function exportPLData() {
    console.log('📤 Exporting PL data...');
    
    try {
        // Check if we have data to export
        const dataToExport = Object.entries(plDatabase).map(([jobId, data]) => ({
            'Job ID': jobId,
            'Job Number': data.jobNumber || '',
            'Job Name': data.jobName || data.name || '',
            'Machine': data.machine || '',
            'Priority': data.priority || '',
            'Planning Status': data.planningStatus || 'Unplanned',
            'AW Status': data.prepressStatus || data.awStatus || 'Unknown',
            'Status Date': data.statusDate ? new Date(data.statusDate).toLocaleDateString() : '',
            'Estimated Date': data.estimatedDate ? new Date(data.estimatedDate).toLocaleDateString() : '',
            'Setup Time (min)': data.setupTime || data.setup || 0,
            'Quantity (m)': data.meters || data.quantity || 0,
            'Machine Speed': data.machineSpeed || 200,
            'Material Type': data.materialType || '',
            'Thickness': data.thickness || '',
            'Film': data.film || '',
            'Cutting Method': data.cuttingMethod || '',
            'New Plat': data.newPlat || '',
            'Material Availability': data.materialAvailability || '',
            'Delivered': data.delivered || '',
            'Delivered2': data.delivered2 || '',
            'Downtime': data.downtime || 0,
            'Is Complete': data.isComplete ? 'Yes' : 'No',
            'Is Planned': data.isPlanned ? 'Yes' : 'No'
        }));
        
        if (dataToExport.length === 0) {
            showNotification('⚠️ No data to export!', 'warning');
            return;
        }
        
        // Create workbook
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(dataToExport);
        
        // Auto-size columns
        const colWidths = [];
        for (let i = 0; i < Object.keys(dataToExport[0]).length; i++) {
            colWidths.push({ wch: 15 });
        }
        ws['!cols'] = colWidths;
        
        XLSX.utils.book_append_sheet(wb, ws, 'PL Data');
        
        // Generate filename with date
        const now = new Date();
        const dateStr = now.toISOString().split('T')[0];
        const filename = `PL_Export_${dateStr}.xlsx`;
        
        // Save file
        XLSX.writeFile(wb, filename);
        
        showNotification(`✅ Exported ${dataToExport.length} jobs to ${filename}`, 'success');
        console.log(`✅ Exported ${dataToExport.length} jobs to ${filename}`);
        
    } catch (error) {
        console.error('❌ Export failed:', error);
        showNotification('❌ Export failed: ' + error.message, 'error');
    }
}

// Make sure to expose it to window
window.exportPLData = exportPLData;

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


// upload.js - Add this function after getTimelineId

// ============================================================
// GET FIRST JOB START TIME
// ============================================================
function getFirstJobStartTime(timelineId) {
    const timeline = document.getElementById(timelineId);
    if (!timeline) return Date.now();
    
    // Check for printed jobs first
    const printedJobs = timeline.querySelectorAll('.job.job-printed');
    if (printedJobs.length > 0) {
        // Get the end time of the last printed job
        const lastPrinted = printedJobs[printedJobs.length - 1];
        const lastPrintedId = lastPrinted.getAttribute('data-job-id');
        if (jobSchedule[lastPrintedId]) {
            console.log(`📊 First job start time from printed: ${new Date(jobSchedule[lastPrintedId].endTime).toLocaleTimeString()}`);
            return jobSchedule[lastPrintedId].endTime;
        }
    }
    
    // If there are existing active jobs, use their start time
    const activeJobs = timeline.querySelectorAll('.job:not(.job-printed)');
    if (activeJobs.length > 0) {
        const firstJob = activeJobs[0];
        const firstJobId = firstJob.getAttribute('data-job-id');
        if (jobSchedule[firstJobId]) {
            console.log(`📊 First job start time from active: ${new Date(jobSchedule[firstJobId].startTime).toLocaleTimeString()}`);
            return jobSchedule[firstJobId].startTime;
        }
    }
    
    // Default to current time
    console.log(`📊 No existing jobs, using current time`);
    return Date.now();
}

// ============================================================
// SAVE SCHEDULE TO SUPABASE
// ============================================================
async function saveScheduleToSupabase(jobId, timelineId, startTime, endTime) {
    try {
        const scheduleData = {
            job_id: jobId,
            start_time: new Date(startTime).toISOString(),
            end_time: new Date(endTime).toISOString(),
            timeline_id: timelineId,
            is_printed: false
        };
        await supabaseSaveSchedule(jobId, scheduleData);
        return true;
    } catch (error) {
        console.warn(`⚠️ Could not save schedule for ${jobId}:`, error.message);
        return false;
    }
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
    const exportBtn = document.getElementById('export-pl-btn');
    if (exportBtn) {
        // Remove any existing event listeners by cloning
        const newExportBtn = exportBtn.cloneNode(true);
        exportBtn.parentNode.replaceChild(newExportBtn, exportBtn);
        
        newExportBtn.addEventListener('click', function(e) {
            e.preventDefault();
            console.log('Export button clicked');
            exportPLData();
        });
        console.log('✅ Export button handler attached');
    } else {
        console.warn('⚠️ Export button #export-pl-btn not found in DOM');
    }
}

// ============================================================
// HANDLE AW UPLOAD
// ============================================================
// ============================================================
// HANDLE AW UPLOAD - WITH PERMISSION CHECKS
// ============================================================
function handleAWUpload(file) {
    // ============================================================
    // PERMISSION CHECK - Only Admin and AW Group can upload AW files
    // ============================================================
    if (!canUploadAW()) {
        showNotification('❌ You don\'t have permission to upload AW files', 'error');
        console.warn(`⚠️ User ${currentUserProfile?.display_name || 'Unknown'} (${getCurrentRole()}) attempted to upload AW file`);
        return;
    }
    
    console.log(`📤 Uploading AW Excel file: ${file.name} (User: ${currentUserProfile?.display_name || 'Unknown'}, Role: ${getCurrentRole()})`);
    showUploadProgress('📖 Reading AW file...', 10);
    
    const reader = new FileReader();
    
    reader.onload = function(e) {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            
            const sheetNames = workbook.SheetNames;
            const detected = detectUploader(sheetNames);
            const firstSheet = workbook.Sheets[sheetNames[0]];
            const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });
            
            showUploadProgress('🔄 Processing AW data...', 50);
            const rows = jsonData.slice(3);
            let awJobsFound = 0;
            let awJobsUpdated = 0;
            
            // Collect data to save to Supabase
            const awDataToSave = {};
            const jobsToUpdate = [];
            
            rows.forEach((row) => {
                if (!row || row.length < 10) return;
                const jobNumber = String(row[5] || '').trim();
                const status = String(row[8] || '').trim();
                if (!jobNumber) return;
                
                // ============================================================
                // PARSE STATUS DATE
                // ============================================================
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
                
                // ============================================================
                // STORE AW DATA IN MEMORY
                // ============================================================
                awData[jobNumber] = {
                    status: rawStatus,
                    rawStatus: rawStatus,
                    statusDate: statusDate.toISOString(),
                    estimatedDate: estimatedDate ? estimatedDate.toISOString() : null,
                    isFromAW: true,
                    uploadedBy: currentUserProfile?.display_name || 'Unknown',
                    uploadedAt: new Date().toISOString()
                };
                
                // ============================================================
                // PREPARE FOR SUPABASE SAVE
                // ============================================================
                awDataToSave[jobNumber] = {
                    job_number: jobNumber,
                    status: rawStatus,
                    raw_status: rawStatus,
                    status_date: statusDate.toISOString(),
                    estimated_date: estimatedDate ? estimatedDate.toISOString() : null,
                    is_from_aw: true
                };
                
                // ============================================================
                // UPDATE JOB IF IT EXISTS
                // ============================================================
                let jobId = findJobIdByNumber(jobNumber);
                if (jobId && jobDatabase[jobId]) {
                    // Only update AW-related fields (not PL fields)
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
                    
                    awJobsUpdated++;
                    jobsToUpdate.push(jobId);
                }
                awJobsFound++;
            });
            
            // ============================================================
            // SAVE AW DATA TO SUPABASE
            // ============================================================
            if (Object.keys(awDataToSave).length > 0) {
                showUploadProgress(`💾 Saving ${Object.keys(awDataToSave).length} AW records to database...`, 70);
                
                // Save AW data using the corrected function
                supabaseSaveMultipleAWData(awDataToSave).then(success => {
                    if (success) {
                        console.log(`✅ ${Object.keys(awDataToSave).length} AW records saved to Supabase`);
                        // Log to audit
                        logAuditAction('AW_UPLOAD', 'aw_data', Object.keys(awDataToSave).length + ' records', {
                            recordsCount: Object.keys(awDataToSave).length,
                            jobsUpdated: awJobsUpdated,
                            fileName: file.name
                        });
                    } else {
                        console.warn('⚠️ Some AW records may not have been saved');
                    }
                });
            }
            
            // ============================================================
            // UPDATE JOBS IN SUPABASE (AW fields only)
            // ============================================================
            if (awJobsUpdated > 0) {
                showUploadProgress(`💾 Updating ${awJobsUpdated} jobs in database...`, 80);
                
                // Update each job that was modified (only AW fields)
                for (const [jobId, jobData] of Object.entries(jobDatabase)) {
                    if (jobData.rawAWStatus && jobData.rawAWStatus !== 'Unknown' && jobData.rawAWStatus !== 'Missing Data') {
                        const snakeData = convertCamelToSnake(jobData);
                        snakeData.job_id = jobId;
                        
                        // Only include AW-related fields to prevent overwriting PL data
                        const awFieldsOnly = {
                            job_id: jobId,
                            aw_status: snakeData.aw_status,
                            raw_aw_status: snakeData.raw_aw_status,
                            status: snakeData.status,
                            status_date: snakeData.status_date,
                            estimated_date: snakeData.estimated_date
                        };
                        
                        supabaseSaveJob(jobId, awFieldsOnly).then(success => {
                            if (success) {
                                console.log(`✅ Job ${jobId} updated with AW status: ${jobData.rawAWStatus}`);
                            }
                        });
                    }
                }
            }
            
            // ============================================================
            // UPDATE UPLOAD STATUS
            // ============================================================
            if (detected.fullData) {
                updateUploadStatus('mahmoud');
                updateUploadStatus('raed');
                updateUploadStatus('rabia');
                showNotification(`✅ Full Data uploaded - ${awJobsUpdated} jobs updated, ${awJobsFound} AW records`, 'success');
            } else {
                if (detected.mahmoud) updateUploadStatus('mahmoud');
                if (detected.raed) updateUploadStatus('raed');
                if (detected.rabia) updateUploadStatus('rabia');
                showNotification(`✅ AW data uploaded - ${awJobsUpdated} jobs updated, ${awJobsFound} records`, 'success');
            }
            
            // ============================================================
            // UPDATE UI
            // ============================================================
            populateProductionFeed();
            applyFilter();
            updateFilterCounts();
            updateStatistics();
            updateFilterBadge();
            syncFilterCheckboxes();
            
            // ============================================================
            // LOG TO AUDIT (if available)
            // ============================================================
            if (typeof logAuditAction === 'function') {
                logAuditAction('AW_UPLOAD', 'aw_data', file.name, {
                    recordsFound: awJobsFound,
                    jobsUpdated: awJobsUpdated,
                    uploader: currentUserProfile?.display_name || 'Unknown',
                    role: getCurrentRole(),
                    detectedUploaders: detected
                });
            }
            
            showUploadProgress(`✅ AW upload complete: ${awJobsUpdated} jobs updated`, 100);
            setTimeout(() => hideUploadProgress(), 1500);
            
            console.log(`✅ AW upload completed by ${currentUserProfile?.display_name || 'Unknown'} (${getCurrentRole()}): ${awJobsFound} records, ${awJobsUpdated} jobs updated`);
            
        } catch (error) {
            console.error('❌ Error processing AW file:', error);
            showUploadProgress('❌ Error processing AW file', 100);
            setTimeout(() => hideUploadProgress(), 3000);
            showNotification('❌ Error reading AW Excel file: ' + error.message, 'error');
        }
    };
    
    reader.onerror = function() {
        console.error('❌ Error reading AW file');
        showUploadProgress('❌ Error reading file', 100);
        setTimeout(() => hideUploadProgress(), 3000);
        showNotification('❌ Error reading file. Please try again.', 'error');
    };
    
    reader.readAsArrayBuffer(file);
}

// ============================================================
// HANDLE PL UPLOAD - OPTIMIZED WITH BATCH PROCESSING & PRIORITY
// ============================================================
async function handlePLUpload(file) {
    console.log('⚡ PL UPLOAD STARTED:', file.name);
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
                alert('❌ Sheet "PLAN-WEEK" not found!');
                hideUploadProgress();
                return;
            }
            
            const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 });
            const rows = jsonData.slice(1);
            
            console.log(`📊 Processing ${rows.length} rows...`);
            showUploadProgress(`📊 Processing ${rows.length} rows...`, 10);
            
            // ============================================
            // STEP 1: DEDUPLICATE - Keep only first occurrence
            // ============================================
            const uniqueJobMap = new Map();
            let duplicateCount = 0;
            
            for (const row of rows) {
                if (!row || row.length < 25) continue;
                const jobNumber = String(row[0] || '').trim();
                if (!jobNumber) continue;
                
                // Only keep the first occurrence
                if (uniqueJobMap.has(jobNumber)) {
                    duplicateCount++;
                    console.log(`⚠️ Duplicate found: ${jobNumber}, skipping...`);
                    continue;
                }
                uniqueJobMap.set(jobNumber, row);
            }
            
            const uniqueRows = Array.from(uniqueJobMap.values());
            console.log(`📊 ${uniqueRows.length} unique jobs (${duplicateCount} duplicates removed)`);
            
            if (uniqueRows.length === 0) {
                alert('No valid jobs found in the file!');
                hideUploadProgress();
                return;
            }
            
            // ============================================
            // STEP 2: BUILD DATA FROM UNIQUE ROWS
            // ============================================
            const savedAWData = { ...awData };
            const jobsToSave = [];
            const plToSave = [];
            let jobsAdded = 0;
            let jobsWithAW = 0;
            const startTime = Date.now();
            
            for (const row of uniqueRows) {
                if (!row || row.length < 25) continue;
                
                const jobNumber = String(row[0] || '').trim();
                if (!jobNumber) continue;
                
                // ============================================
                // READ ALL FIELDS FROM EXCEL
                // ============================================
                const jobName = String(row[1] || '').trim() || 'Unnamed Job';
                const newPlat = String(row[2] || '').trim() || '';
                const color = String(row[3] || '').trim() || ''; // Column D (index 3)
                const materialAvailability = String(row[4] || '').trim() || '';
                const planningStatus = String(row[5] || '').trim() || 'Unplanned';
                const delivered = String(row[6] || '').trim() || '';
                const delivered2 = String(row[7] || '').trim() || '';
                const machine = String(row[8] || '').trim() || '';
                
                // ✅ PRIORITY - Cell J (index 9) - smaller number = higher priority
                const priority = parseInt(row[9]) || 999;
                
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
                const isUnplanned = planningStatus === 'Unplanned';
                const isDeleted = planningStatus === 'Deleted' || planningStatus === 'PL-Deleted';
                const isHold = planningStatus === 'Hold' || planningStatus === 'PL-Hold';
                
                const jobId = `job-${jobNumber}`;
                
                let effectiveStatus = awStatus;
                if (isComplete) effectiveStatus = 'Complete';
                else if (isPlanned) effectiveStatus = 'Planned';
                else if (isUnplanned) effectiveStatus = 'Unplanned';
                else if (isDeleted) effectiveStatus = 'PL-Deleted';
                else if (isHold) effectiveStatus = 'PL-Hold';
                else if (awStatus === 'Unknown') {
                    effectiveStatus = planningStatus || 'Unplanned';
                }
                
                // Store in memory
                jobDatabase[jobId] = {
                    name: jobName,
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
                    priority: priority,
                    newPlat: newPlat,
                    // color: color,
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
                    // color: color,
                    prepressStatus: awStatus || 'Unknown',
                    materialAvailability: materialAvailability,
                    planningStatus: planningStatus || 'Unplanned',
                    delivered: delivered,
                    delivered2: delivered2,
                    machine: machine,
                    priority: priority,
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
                
                // Add to bulk arrays (snake_case for DB)
                jobsToSave.push({
                    job_id: jobId,
                    job_number: jobNumber,
                    name: jobName,
                    status: effectiveStatus,
                    aw_status: awStatus,
                    raw_aw_status: awStatus,
                    planning_status: planningStatus || 'Unplanned',
                    status_date: statusDate.toISOString(),
                    estimated_date: estimatedDate ? estimatedDate.toISOString() : null,
                    setup: setupTime || plannedSetup || 120,
                    quantity: meters || quantity || 0,
                    machine: machine || '',
                    priority: priority,
                    is_complete: isComplete || false,
                    is_planned: isPlanned || false,
                    is_unplanned: isUnplanned || false,
                    is_deleted: isDeleted || false,
                    is_hold: isHold || false,
                    new_plat: newPlat || '',
                    // color: color || '',
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
                    // color: color || '',
                    prepress_status: awStatus || 'Unknown',
                    material_availability: materialAvailability || '',
                    planning_status: planningStatus || 'Unplanned',
                    delivered: delivered || '',
                    delivered2: delivered2 || '',
                    machine: machine || '',
                    priority: priority,
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
                    is_unplanned: isUnplanned || false,
                    is_deleted: isDeleted || false,
                    is_hold: isHold || false,
                    status_date: statusDate.toISOString(),
                    estimated_date: estimatedDate ? estimatedDate.toISOString() : null
                });
                
                jobsAdded++;
            }
            
            console.log(`✅ ${jobsAdded} unique jobs prepared (${jobsWithAW} with AW data)`);
            
            if (jobsToSave.length === 0) {
                alert('No valid jobs found in the file!');
                hideUploadProgress();
                return;
            }
            
            // ============================================
            // STEP 3: UPSERT DATA USING BATCH PROCESSING
            // ============================================
            showUploadProgress(`💾 Uploading ${jobsToSave.length} unique jobs...`, 30);
            
            const client = initSupabase();
            const BATCH_SIZE = 100;
            let saved = 0;
            let failed = 0;
            let insertedCount = 0;
            let updatedCount = 0;
            
            // Check which jobs already exist
            const existingJobIds = new Set();
            try {
                const existing = await supabaseLoadAllJobs();
                if (existing) {
                    existing.forEach(j => existingJobIds.add(j.job_id));
                }
            } catch (e) {
                console.warn('⚠️ Could not fetch existing jobs:', e.message);
            }
            
            // Process in batches with retry
            for (let i = 0; i < jobsToSave.length; i += BATCH_SIZE) {
                const batch = jobsToSave.slice(i, i + BATCH_SIZE);
                let retries = 3;
                let success = false;
                
                while (retries > 0 && !success) {
                    try {
                        const { error } = await client
                            .from('jobs')
                            .upsert(batch, { 
                                onConflict: 'job_id',
                                ignoreDuplicates: false
                            });
                        
                        if (error) {
                            console.warn(`⚠️ Batch ${Math.floor(i/BATCH_SIZE)+1} error:`, error.message);
                            retries--;
                            if (retries > 0) {
                                console.log(`⏳ Retrying batch ${Math.floor(i/BATCH_SIZE)+1}... (${retries} retries left)`);
                                await new Promise(resolve => setTimeout(resolve, 1000));
                            }
                        } else {
                            success = true;
                            saved += batch.length;
                            for (const job of batch) {
                                if (existingJobIds.has(job.job_id)) {
                                    updatedCount++;
                                } else {
                                    insertedCount++;
                                    existingJobIds.add(job.job_id);
                                }
                            }
                        }
                    } catch (err) {
                        console.error(`❌ Batch ${Math.floor(i/BATCH_SIZE)+1} failed:`, err.message);
                        retries--;
                        if (retries > 0) {
                            await new Promise(resolve => setTimeout(resolve, 1000));
                        }
                    }
                }
                
                if (!success) {
                    failed += batch.length;
                    console.error(`❌ Batch ${Math.floor(i/BATCH_SIZE)+1} failed after all retries`);
                }
                
                const elapsed = Math.round((Date.now() - startTime) / 1000);
                const percent = Math.min(90, 30 + Math.round((saved / jobsToSave.length) * 60));
                showUploadProgress(`📊 ${saved}/${jobsToSave.length} jobs (${elapsed}s)`, percent);
                console.log(`✅ ${saved}/${jobsToSave.length} jobs processed (${elapsed}s)`);
            }
            
            // Save PL data
            if (plToSave.length > 0) {
                showUploadProgress('💾 Saving PL data...', 92);
                for (let i = 0; i < plToSave.length; i += BATCH_SIZE) {
                    const batch = plToSave.slice(i, i + BATCH_SIZE);
                    try {
                        const { error } = await client
                            .from('pl_database')
                            .upsert(batch, { onConflict: 'job_id' });
                        if (error) {
                            console.warn('⚠️ PL batch error:', error.message);
                        }
                    } catch (e) {
                        console.warn('⚠️ PL batch failed:', e.message);
                    }
                }
            }
            
            const totalTime = Math.round((Date.now() - startTime) / 1000);
            console.log(`✅ ${saved} jobs saved (${insertedCount} new, ${updatedCount} updated, ${failed} failed) in ${totalTime}s`);
            
            // ============================================
            // STEP 4: RELOAD DATA
            // ============================================
            showUploadProgress('🔄 Reloading data from database...', 94);
            await supabaseSyncAllData();
            
            // ============================================
            // STEP 5: OPTIMIZED TIMELINE UPDATE - Don't clear all jobs
            // ============================================
// ============================================
// STEP 5: OPTIMIZED TIMELINE UPDATE - FIXED
// ============================================
showUploadProgress('📋 Updating timelines...', 95);

// Group Planned jobs by machine
const plannedJobsByMachine = {};
for (const [jobId, jobData] of Object.entries(jobDatabase)) {
    if (jobData.planningStatus === 'Planned' && jobData.machine) {
        const machine = jobData.machine;
        if (!plannedJobsByMachine[machine]) {
            plannedJobsByMachine[machine] = [];
        }
        plannedJobsByMachine[machine].push({
            jobId: jobId,
            jobData: jobData,
            priority: jobData.priority || 999
        });
    }
}

// Sort each machine's jobs by priority
for (const machine in plannedJobsByMachine) {
    plannedJobsByMachine[machine].sort((a, b) => a.priority - b.priority);
}

let timelineJobsAdded = 0;
const schedulesToSave = [];

// Process each machine's timeline
for (const [machine, jobs] of Object.entries(plannedJobsByMachine)) {
    const timelineId = getTimelineId(machine);
    if (!timelineId) continue;
    
    const timeline = document.getElementById(timelineId);
    if (!timeline) continue;
    
    // ⭐ CRITICAL FIX: Get the correct start time for the first job
    // This handles printed jobs correctly
    let currentTime = getFirstJobStartTime(timelineId);
    
    // Get existing jobs on this timeline
    const existingJobIds = new Set();
    timeline.querySelectorAll('.job:not(.job-printed)').forEach(job => {
        const id = job.getAttribute('data-job-id');
        existingJobIds.add(id);
    });
    
    // Remove jobs that are no longer Planned
    const jobsToRemove = [];
    for (const jobId of existingJobIds) {
        if (!jobDatabase[jobId] || jobDatabase[jobId].planningStatus !== 'Planned') {
            jobsToRemove.push(jobId);
        }
    }
    
    for (const jobId of jobsToRemove) {
        const jobElement = timeline.querySelector(`.job[data-job-id="${jobId}"]`);
        if (jobElement) {
            jobElement.remove();
            delete jobSchedule[jobId];
        }
    }
    
    // Get remaining active jobs
    const remainingJobs = timeline.querySelectorAll('.job:not(.job-printed)');
    
    // ⭐ CRITICAL FIX: If there are remaining jobs, find the first one's start time
    if (remainingJobs.length > 0) {
        const firstRemaining = remainingJobs[0];
        const firstId = firstRemaining.getAttribute('data-job-id');
        if (jobSchedule[firstId]) {
            currentTime = jobSchedule[firstId].startTime;
            console.log(`📊 Timeline ${timelineId} has existing jobs, starting at: ${new Date(currentTime).toLocaleTimeString()}`);
        }
    }
    
    // Recalculate from the first job to ensure consistency
    console.log(`📊 Timeline ${timelineId} starting time: ${new Date(currentTime).toLocaleTimeString()}`);
    
    // Add new Planned jobs in priority order
    for (const { jobId, jobData } of jobs) {
        const existingJob = timeline.querySelector(`.job[data-job-id="${jobId}"]`);
        if (existingJob) {
            // Update existing job
            const newJobElement = createJobElement(jobId, jobData);
            existingJob.replaceWith(newJobElement);
            if (jobSchedule[jobId]) {
                updateJobTimeDisplay(jobId);
            }
            continue;
        }
        
        // Add new job
        const duration = calculateJobDuration(jobData, jobId) * 60000;
        const endTime = currentTime + duration;
        
        const jobElement = createJobElement(jobId, jobData);
        const firstPrinted = timeline.querySelector('.job.job-printed');
        if (firstPrinted) {
            // Insert after printed jobs
            const printedCount = timeline.querySelectorAll('.job.job-printed').length;
            const activeJobs = timeline.querySelectorAll('.job:not(.job-printed)');
            
            // Find the correct position based on priority
            let inserted = false;
            for (let i = 0; i < activeJobs.length; i++) {
                const existing = activeJobs[i];
                const existingId = existing.getAttribute('data-job-id');
                const existingPriority = jobDatabase[existingId]?.priority || 999;
                const newPriority = jobData.priority || 999;
                
                if (newPriority < existingPriority) {
                    timeline.insertBefore(jobElement, existing);
                    inserted = true;
                    break;
                }
            }
            if (!inserted) {
                // Insert at the end of active jobs (before any future additions)
                if (activeJobs.length > 0) {
                    timeline.insertBefore(jobElement, activeJobs[activeJobs.length - 1].nextSibling);
                } else {
                    timeline.insertBefore(jobElement, firstPrinted);
                }
            }
        } else {
            // No printed jobs, append at the end
            timeline.appendChild(jobElement);
        }
        
        jobSchedule[jobId] = {
            startTime: currentTime,
            endTime: endTime,
            timelineId: timelineId,
            isPrinted: false
        };
        
        schedulesToSave.push({
            job_id: jobId,
            start_time: new Date(currentTime).toISOString(),
            end_time: new Date(endTime).toISOString(),
            timeline_id: timelineId,
            is_printed: false
        });
        
        currentTime = endTime;
        timelineJobsAdded++;
    }
    
    // Sort by priority
    if (typeof sortTimelineJobsByPriority === 'function') {
        sortTimelineJobsByPriority(timeline);
    }
    
    // Clear cache and rescale
    delete timelineStateCache[timelineId];
    scaleTimeline(timelineId);
    updateMachineStatus(timeline.closest('.machine'));
}

// Save schedules to Supabase
if (schedulesToSave.length > 0) {
    showUploadProgress(`💾 Saving ${schedulesToSave.length} schedules...`, 97);
    try {
        for (let i = 0; i < schedulesToSave.length; i += 100) {
            const batch = schedulesToSave.slice(i, i + 100);
            const scheduleMap = {};
            for (const s of batch) {
                scheduleMap[s.job_id] = {
                    start_time: s.start_time,
                    end_time: s.end_time,
                    timeline_id: s.timeline_id,
                    is_printed: s.is_printed
                };
            }
            await supabaseSaveMultipleSchedules(scheduleMap);
        }
        console.log(`✅ Saved ${schedulesToSave.length} schedules to Supabase`);
    } catch (e) {
        console.warn('⚠️ Could not save schedules:', e.message);
    }
}
            
            // ============================================
            // STEP 6: FINAL UI UPDATE
            // ============================================
            showUploadProgress('🔄 Updating UI...', 98);
            
            // Reschedule all timelines
            document.querySelectorAll('.timeline').forEach(timeline => {
                rescheduleTimelineJobs(timeline.id, true);
                scaleTimeline(timeline.id);
            });
            
            // Update all UI elements
            updateAllMachineStatuses();
            updateAllJobColors();
            updateAllJobTimes();
            updateAllNowIndicators();
            
            updateUploadStatus('qasem');
            
            showUploadProgress(`✅ ${saved} jobs uploaded in ${totalTime}s`, 100);
            
            // Final refresh after everything is settled
            setTimeout(() => {
                hideUploadProgress();
                populateProductionFeed();
                updateStatistics();
                
                // Refresh all timelines to fix rulers
                setTimeout(() => {
                    if (typeof refreshAllTimelines === 'function') {
                        refreshAllTimelines();
                    }
                    applySmartZoom();
                    setTimeout(() => updateAllTimelineScrollPositions(), 300);
                }, 300);
                
                // Show notification
                let message = '';
                if (failed > 0) {
                    message = `⚠️ ${saved} jobs uploaded (${insertedCount} new, ${updatedCount} updated), ${failed} failed. ${timelineJobsAdded} on timeline.`;
                    showNotification(message, 'warning');
                } else {
                    message = `✅ ${saved} jobs uploaded (${insertedCount} new, ${updatedCount} updated) - ${timelineJobsAdded} Planned on timeline in ${totalTime}s`;
                    showNotification(message, 'success');
                }
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


// 🔴 CRITICAL FIX: Update qasem status with proper timestamp
const now = new Date();
uploadStatus['qasem'].lastUpdated = now;
uploadStatus['qasem'].status = 'updated';
if (typeof supabaseUpdateUploadStatus === 'function') {
    supabaseUpdateUploadStatus('qasem', 'updated');
}
    reader.readAsArrayBuffer(file);
}

// ============================================================
// START UPLOAD STATUS MONITORING - FIXED
// ============================================================
function startUploadStatusMonitoring() {
    // Run initial check
    checkUploadValidity();
    
    // Update status indicators immediately
    setTimeout(function() {
        updateStatusIndicators();
    }, 100);
    
    // 🔴 CRITICAL FIX: Check every 5 minutes instead of 30 seconds
    if (statusCheckInterval) {
        clearInterval(statusCheckInterval);
    }
    statusCheckInterval = setInterval(checkUploadValidity, 300000); // 5 minutes
    
    console.log(`📊 Upload status monitoring started (checking every 5 minutes, validity: ${UPLOAD_VALIDITY_MINUTES} minutes)`);
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
window.saveScheduleToSupabase = saveScheduleToSupabase;

console.log('✅ upload.js loaded - Complete with priority sorting and optimized timeline handling');
