// script-upload.js
// ============================================================
// EXCEL UPLOAD & EXPORT FUNCTIONS
// ============================================================

// script-upload.js
// ============================================================
// EXCEL UPLOAD & EXPORT FUNCTIONS - MOBILE FRIENDLY
// ============================================================

function setupExcelUploads() {
    // AW Upload
    const uploadBtnAW = document.getElementById('upload-excel-aw');
    const fileInputAW = document.getElementById('file-input-aw');
    
    if (uploadBtnAW && fileInputAW) {
        // For mobile: ensure the file input accepts Excel files
        fileInputAW.setAttribute('accept', '.xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel');
        
        uploadBtnAW.addEventListener('click', function(e) {
            e.preventDefault();
            console.log('AW Upload button clicked');
            // For mobile, we need to trigger the file input
            fileInputAW.click();
        });
        
        // Also handle touch events for mobile
        uploadBtnAW.addEventListener('touchstart', function(e) {
            // Prevent double-firing on mobile
            if (!this._touched) {
                this._touched = true;
                setTimeout(() => { this._touched = false; }, 300);
            }
        });
        
        fileInputAW.addEventListener('change', function(e) {
            const file = this.files[0];
            if (file) {
                console.log('AW file selected:', file.name);
                // Check file extension
                const validExtensions = ['.xlsx', '.xls'];
                const fileExt = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
                
                if (validExtensions.includes(fileExt) || file.name.toLowerCase().includes('aw')) {
                    handleAWUpload(file);
                } else {
                    alert('Please upload an Excel file (.xlsx or .xls) named "AW"');
                }
            }
            // Reset the input so the same file can be selected again
            this.value = '';
        });
    }
    
    // PL Upload
    const uploadBtnPL = document.getElementById('upload-excel-pl');
    const fileInputPL = document.getElementById('file-input-pl');
    
    if (uploadBtnPL && fileInputPL) {
        // For mobile: ensure the file input accepts Excel files
        fileInputPL.setAttribute('accept', '.xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel');
        
        uploadBtnPL.addEventListener('click', function(e) {
            e.preventDefault();
            console.log('PL Upload button clicked');
            fileInputPL.click();
        });
        
        // Also handle touch events for mobile
        uploadBtnPL.addEventListener('touchstart', function(e) {
            if (!this._touched) {
                this._touched = true;
                setTimeout(() => { this._touched = false; }, 300);
            }
        });
        
        fileInputPL.addEventListener('change', function(e) {
            const file = this.files[0];
            if (file) {
                console.log('PL file selected:', file.name);
                const validExtensions = ['.xlsx', '.xls'];
                const fileExt = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
                
                if (validExtensions.includes(fileExt) || file.name.toLowerCase().includes('ci planning shared')) {
                    handlePLUpload(file);
                } else {
                    alert('Please upload an Excel file (.xlsx or .xls) named "CI Planning Shared"');
                }
            }
            this.value = '';
        });
    }
}

// ============================================================
// MOBILE-FRIENDLY FILE INPUT FIX
// ============================================================

// For iOS Safari, we need to handle the file input differently
function setupMobileFileInputs() {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
                  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    
    if (isIOS) {
        console.log('iOS detected - applying mobile file input fixes');
        
        // For iOS, we need to ensure the file input is triggered properly
        const fileInputs = document.querySelectorAll('input[type="file"]');
        fileInputs.forEach(input => {
            // Remove the display:none and make it invisible but clickable
            input.style.cssText = `
                position: absolute;
                width: 0;
                height: 0;
                opacity: 0;
                overflow: hidden;
                z-index: -1;
            `;
            
            // Add a label that triggers the file input
            const parent = input.parentElement;
            if (parent) {
                const label = document.createElement('label');
                label.setAttribute('for', input.id);
                label.style.cssText = `
                    display: none;
                `;
                parent.appendChild(label);
            }
        });
    }
}

// Call this on DOM ready
document.addEventListener('DOMContentLoaded', function() {
    setupMobileFileInputs();
});

// ============================================================
// HANDLE AW UPLOAD
// ============================================================

function handleAWUpload(file) {
    console.log('Uploading AW Excel file:', file.name);
    
    // Check if it's actually an Excel file
    const validTypes = [
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-excel',
        'application/vnd.ms-excel.sheet.macroEnabled.12'
    ];
    
    // Some mobile browsers don't set the type correctly, so check extension too
    const fileExt = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
    const validExtensions = ['.xlsx', '.xls'];
    
    if (!validExtensions.includes(fileExt) && !validTypes.includes(file.type)) {
        // Try to proceed anyway - it might still be an Excel file
        console.warn('File type not recognized as Excel, but trying to process:', file.type);
    }
    
    showUploadProgress('Reading AW file...', 10);
    
    const reader = new FileReader();
    
    reader.onload = function(e) {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            
            const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
            const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });
            
            console.log('AW data rows:', jsonData.length);
            
            showUploadProgress('Processing AW data...', 50);
            
            const rows = jsonData.slice(3);
            let awJobsFound = 0;
            
            rows.forEach((row, index) => {
                if (!row || row.length < 10) {
                    console.log(`Row ${index + 4} has insufficient data, skipping`);
                    return;
                }
                
                const jobNumber = String(row[5] || '').trim();
                const status = String(row[8] || '').trim();
                
                if (!jobNumber) {
                    console.log(`Row ${index + 4} has no job number, skipping`);
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
                
                // Calculate estimated date based on status
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
                    console.log(`Found matching job in PL: ${jobId}`);
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
                    console.log(`No matching job found for ${jobNumber} in PL database`);
                }
            });
            
            populateProductionFeed();
            applyFilter();
            updateFilterCounts(); 
            
            showUploadProgress(`AW upload complete: ${awJobsFound} jobs updated`, 100);
            
            setTimeout(() => {
                hideUploadProgress();
                updateStatistics();
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

function findJobIdByNumber(jobNumber) {
    for (const [id, data] of Object.entries(jobDatabase)) {
        if (data.jobNumber === jobNumber) return id;
    }
    return null;
}

function handleAWUpload(file) {
    console.log('Uploading AW Excel file:', file.name);
    
    showUploadProgress('Reading AW file...', 10);
    
    const reader = new FileReader();
    
    reader.onload = function(e) {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            
            const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
            const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });
            
            console.log('AW data rows:', jsonData.length);
            
            showUploadProgress('Processing AW data...', 50);
            
            const rows = jsonData.slice(3);
            let awJobsFound = 0;
            
            rows.forEach((row, index) => {
                if (!row || row.length < 10) {
                    console.log(`Row ${index + 4} has insufficient data, skipping`);
                    return;
                }
                
                const jobNumber = String(row[5] || '').trim();
                const status = String(row[8] || '').trim();
                
                if (!jobNumber) {
                    console.log(`Row ${index + 4} has no job number, skipping`);
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
                
                // Calculate estimated date based on status
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
                    console.log(`Found matching job in PL: ${jobId}`);
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
                    console.log(`No matching job found for ${jobNumber} in PL database`);
                }
            });
            
            populateProductionFeed();
            applyFilter();
            updateFilterCounts(); 
            
            showUploadProgress(`AW upload complete: ${awJobsFound} jobs updated`, 100);
            
            setTimeout(() => {
                hideUploadProgress();
                updateStatistics();
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
function handlePLUpload(file) {
    console.log('Uploading PL Excel file:', file.name);
    
    showUploadProgress('Reading PL file...', 10);
    
    const reader = new FileReader();
    
    reader.onload = function(e) {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            
            // Get the PLAN-WEEK sheet
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
            let jobsUpdated = 0;
            let jobsOnTimeline = 0;
            
            // IMPORTANT: Clear existing jobDatabase and plDatabase before processing
            // BUT preserve awData for status lookup
            // We'll clear and rebuild from PL data
            
            // Store existing job IDs that are on timelines
            const existingTimelineJobs = {};
            document.querySelectorAll('.job').forEach(job => {
                const jobId = job.getAttribute('data-job-id');
                if (jobId && !job.classList.contains('job-printed')) {
                    existingTimelineJobs[jobId] = job;
                }
            });
            
            // Clear jobDatabase but keep awData
            const oldJobDatabase = { ...jobDatabase };
            Object.keys(jobDatabase).forEach(key => delete jobDatabase[key]);
            Object.keys(plDatabase).forEach(key => delete plDatabase[key]);
            
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
                
                // Check if job exists in AW data for status
                let awStatus = 'Unknown';
                let statusDate = new Date(1900, 0, 1);
                let estimatedDate = null;
                
                if (awData[jobNumber]) {
                    awStatus = awData[jobNumber].status || 'Unknown';
                    if (awData[jobNumber].statusDate) {
                        const parsedDate = new Date(awData[jobNumber].statusDate);
                        if (!isNaN(parsedDate.getTime()) && parsedDate.getFullYear() > 1900) {
                            statusDate = parsedDate;
                        }
                    }
                    if (awData[jobNumber].estimatedDate) {
                        const parsedDate = new Date(awData[jobNumber].estimatedDate);
                        if (!isNaN(parsedDate.getTime()) && parsedDate.getFullYear() > 1900) {
                            estimatedDate = parsedDate;
                        }
                    }
                    console.log(`Found AW data for ${jobNumber}: ${awStatus}`);
                } else {
                    console.log(`No AW data found for ${jobNumber} - setting AW status to "Unknown"`);
                }
                
                const isPlanned = planningStatus === 'Planned';
                const isComplete = planningStatus === 'Complete' || planningStatus === 'Printed';
                const isUnprinted = planningStatus === 'Unprinted';
                const isDeleted = planningStatus === 'Deleted' || planningStatus === 'PL-Deleted';
                const isHold = planningStatus === 'Hold' || planningStatus === 'PL-Hold';
                
                // Generate a unique job ID
                const jobId = 'job-' + (Object.keys(jobDatabase).length + 1);
                
                // Determine effective status
                let effectiveStatus = awStatus;
                if (isComplete) effectiveStatus = 'Complete';
                else if (isPlanned) effectiveStatus = 'Planned';
                else if (isUnprinted) effectiveStatus = 'Unprinted';
                else if (isDeleted) effectiveStatus = 'PL-Deleted';
                else if (isHold) effectiveStatus = 'PL-Hold';
                
                // Create job in database
                jobDatabase[jobId] = {
                    name: jobName || 'Unnamed Job',
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
                    // Store PL data
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
                
                // Store PL data separately for export
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
                
                jobsAdded++;
            });
            
            console.log(`Added ${jobsAdded} jobs to database`);
            
            // Populate the production feed FIRST (before adding to timelines)
            populateProductionFeed();
            
            // Now add jobs to timelines based on PL status
            let timelineJobsAdded = 0;
            
            // Process each job and add to timeline if Planned and has machine
            for (const [jobId, jobData] of Object.entries(jobDatabase)) {
                const machine = jobData.machine;
                const planningStatus = jobData.planningStatus;
                const isPlanned = planningStatus === 'Planned';
                
                // Check if job already exists on timeline
                const existingJob = document.querySelector(`.job[data-job-id="${jobId}"]`);
                
                if (machine && machineIdMap[machine] && isPlanned && !existingJob) {
                    const machineId = machineIdMap[machine];
                    const timelineId = `timeline-${machineId}`;
                    const timeline = document.getElementById(timelineId);
                    
                    if (timeline) {
                        // Add job to timeline
                        const now = new Date().getTime();
                        // Don't remove from feed - it will be handled by addJobToTimelineWithSchedule
                        addJobToTimelineWithSchedule(jobId, timelineId, now);
                        timelineJobsAdded++;
                        console.log(`Added ${jobId} to ${timelineId} (Planned status)`);
                    }
                } else if (existingJob && !isPlanned && !existingJob.classList.contains('job-printed')) {
                    // Job is on timeline but not Planned - remove it
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

function exportPLData() {
    console.log('Exporting PL data...');
    showUploadProgress('Generating export...', 30);
    
    try {
        const headers = [
            'Job Number', 'Job Name', 'NEW PLAT', 'Prepress status', 'Material Availability2',
            'Planning Status', 'DELIVERED', 'DELIVERED2', 'Machine', '', 'Cutting Method',
            'Quantity (WEIGHT)', 'Film', 'Thickness', 'Material Type', 'Machine Speed',
            'Meters', 'setup time in minuets', 'Required Time', 'Planned Speed',
            'Actual Speed', 'Planned Setup time', 'Actual Setup', 'DOWNTIME', 'Printing duration'
        ];
        
        const exportData = [headers];
        for (const [jobId, data] of Object.entries(plDatabase)) {
            const jobData = jobDatabase[jobId] || {};
            const currentSpeed = jobSpeeds[jobId] || jobData.machineSpeed || 200;
            exportData.push([
                data.jobNumber || '', data.jobName || jobData.name || '',
                data.newPlat || '', data.prepressStatus || jobData.awStatus || '',
                data.materialAvailability || '', data.planningStatus || jobData.status || 'Planned',
                data.delivered || '', data.delivered2 || '',
                data.machine || jobData.machine || '', '',
                data.cuttingMethod || jobData.cuttingMethod || '',
                data.quantity || jobData.quantity || 0,
                data.film || jobData.film || '',
                data.thickness || jobData.thickness || '',
                data.materialType || jobData.materialType || '',
                currentSpeed,
                data.meters || jobData.quantity || 0,
                data.setupTime || jobData.setup || 120,
                data.requiredTime || jobData.requiredTime || 0,
                data.plannedSpeed || currentSpeed,
                data.actualSpeed || currentSpeed,
                data.plannedSetup || jobData.setup || 120,
                data.actualSetup || jobData.actualSetup || 0,
                data.downtime || jobData.downtime || 0,
                data.printingDuration || jobData.printingDuration || 0
            ]);
        }
        
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet(exportData);
        XLSX.utils.book_append_sheet(wb, ws, 'PLAN-WEEK');
        const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
        const blob = new Blob([wbout], { type: 'application/octet-stream' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'Downloaded Planning.xlsx';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
        showUploadProgress(`Exported ${Object.keys(plDatabase).length} jobs`, 100);
        setTimeout(() => hideUploadProgress(), 2000);
        console.log('Export completed successfully');
    } catch (error) {
        console.error('Error exporting PL data:', error);
        showUploadProgress('Error exporting data', 100);
        setTimeout(() => hideUploadProgress(), 3000);
        alert('Error exporting data: ' + error.message);
    }
}

// Setup export
document.addEventListener('DOMContentLoaded', function() {
    const downloadBtn = document.getElementById('download-excel-pl');
    if (downloadBtn) downloadBtn.addEventListener('click', exportPLData);
});

window.exportPLData = exportPLData;
window.handleAWUpload = handleAWUpload;
window.handlePLUpload = handlePLUpload;
window.setupExcelUploads = setupExcelUploads;
