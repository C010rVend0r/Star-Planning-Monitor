// script-upload.js
// ============================================================
// EXCEL UPLOAD & EXPORT FUNCTIONS
// ============================================================

function setupExcelUploads() {
    // AW Upload
    const uploadBtnAW = document.getElementById('upload-excel-aw');
    const fileInputAW = document.getElementById('file-input-aw');
    
    if (uploadBtnAW && fileInputAW) {
        uploadBtnAW.addEventListener('click', function() {
            console.log('AW Upload button clicked');
            fileInputAW.click();
        });
        fileInputAW.addEventListener('change', function(e) {
            const file = this.files[0];
            if (file) {
                console.log('AW file selected:', file.name);
                if (file.name.toLowerCase().includes('aw')) {
                    handleAWUpload(file);
                } else {
                    alert('Please upload a file named "AW"');
                }
            }
            this.value = '';
        });
    }
    
    // PL Upload
    const uploadBtnPL = document.getElementById('upload-excel-pl');
    const fileInputPL = document.getElementById('file-input-pl');
    
    if (uploadBtnPL && fileInputPL) {
        uploadBtnPL.addEventListener('click', function() {
            console.log('PL Upload button clicked');
            fileInputPL.click();
        });
        fileInputPL.addEventListener('change', function(e) {
            const file = this.files[0];
            if (file) {
                console.log('PL file selected:', file.name);
                if (file.name.toLowerCase().includes('ci planning shared')) {
                    handlePLUpload(file);
                } else {
                    alert('Please upload a file named "CI Planning Shared"');
                }
            }
            this.value = '';
        });
    }
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
                if (!row || row.length < 10) return;
                
                const jobNumber = String(row[5] || '').trim();
                const status = String(row[8] || '').trim();
                if (!jobNumber) return;
                
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
                            if (!isNaN(jsDate.getTime())) statusDate = jsDate;
                        } else if (typeof dateValue === 'string') {
                            const parsed = new Date(dateValue);
                            if (!isNaN(parsed.getTime()) && parsed.getFullYear() > 1900) statusDate = parsed;
                        }
                    }
                }
                
                if (!statusDate) statusDate = new Date(1900, 0, 1);
                let rawStatus = status || 'Unknown';
                
                awData[jobNumber] = {
                    status: rawStatus,
                    rawStatus: rawStatus,
                    statusDate: statusDate.toISOString(),
                    isFromAW: true
                };
                
                let jobId = findJobIdByNumber(jobNumber);
                if (jobId && jobDatabase[jobId]) {
                    jobDatabase[jobId].awStatus = rawStatus;
                    jobDatabase[jobId].status = rawStatus;
                    jobDatabase[jobId].statusDate = statusDate.toISOString();
                    jobDatabase[jobId].rawAWStatus = rawStatus;
                    if (plDatabase[jobId]) {
                        plDatabase[jobId].prepressStatus = rawStatus;
                        plDatabase[jobId].statusDate = statusDate.toISOString();
                        plDatabase[jobId].rawAWStatus = rawStatus;
                    }
                    awJobsFound++;
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
            
            rows.forEach((row, index) => {
                if (!row || row.length < 25) return;
                
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
                
                if (!jobNumber) return;
                
                console.log(`Processing PL job: ${jobNumber}, planningStatus: "${planningStatus}"`);
                
                let awStatus = 'Unknown';
                let statusDate = new Date(1900, 0, 1);
                
                if (awData[jobNumber]) {
                    awStatus = awData[jobNumber].status || 'Unknown';
                    if (awData[jobNumber].statusDate) {
                        const parsedDate = new Date(awData[jobNumber].statusDate);
                        if (!isNaN(parsedDate.getTime()) && parsedDate.getFullYear() > 1900) {
                            statusDate = parsedDate;
                        }
                    }
                }
                
                const isPlanned = planningStatus === 'Planned';
                const isComplete = planningStatus === 'Complete' || planningStatus === 'Printed';
                const isUnprinted = planningStatus === 'Unprinted';
                
                let jobId = findJobIdByNumber(jobNumber);
                let isNew = false;
                if (!jobId) {
                    jobId = 'job-' + (Object.keys(jobDatabase).length + 1);
                    isNew = true;
                }
                
                let effectiveStatus = awStatus;
                if (isComplete) effectiveStatus = 'Complete';
                else if (isPlanned) effectiveStatus = 'Planned';
                else if (isUnprinted) effectiveStatus = 'Unprinted';
                
                jobDatabase[jobId] = {
                    name: jobName || 'Unnamed Job',
                    jobNumber: jobNumber,
                    status: effectiveStatus,
                    awStatus: awStatus,
                    planningStatus: planningStatus || 'Unprinted',
                    statusDate: statusDate.toISOString(),
                    setup: setupTime || plannedSetup || 120,
                    quantity: meters || quantity || 0,
                    isComplete: isComplete,
                    isPlanned: isPlanned,
                    isUnprinted: isUnprinted,
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
                    jobNumber: jobNumber, jobName: jobName, newPlat: newPlat,
                    prepressStatus: awStatus || 'Unknown',
                    materialAvailability: materialAvailability,
                    planningStatus: planningStatus || 'Unprinted',
                    delivered: delivered, delivered2: delivered2,
                    machine: machine, cuttingMethod: cuttingMethod,
                    quantity: quantity, film: film, thickness: thickness,
                    materialType: materialType, machineSpeed: machineSpeed,
                    meters: meters, setupTime: setupTime,
                    requiredTime: requiredTime, plannedSpeed: plannedSpeed,
                    actualSpeed: actualSpeed, plannedSetup: plannedSetup,
                    actualSetup: actualSetup, downtime: downtime,
                    printingDuration: printingDuration,
                    isComplete: isComplete, isPlanned: isPlanned,
                    isUnprinted: isUnprinted, statusDate: statusDate.toISOString()
                };
                
                if (machine && machineIdMap[machine] && isPlanned) {
                    const machineId = machineIdMap[machine];
                    const timelineId = `timeline-${machineId}`;
                    const timeline = document.getElementById(timelineId);
                    const existingJob = document.querySelector(`.job[data-job-id="${jobId}"]`);
                    if (!existingJob && timeline) {
                        const now = new Date().getTime();
                        addJobToTimelineWithSchedule(jobId, timelineId, now);
                    } else if (existingJob) {
                        updateJobCardDisplay(jobId);
                    }
                } else if (!isPlanned) {
                    const existingJob = document.querySelector(`.job[data-job-id="${jobId}"]`);
                    if (existingJob) {
                        const timeline = existingJob.parentElement;
                        existingJob.remove();
                        delete jobSchedule[jobId];
                        if (timeline) {
                            scaleTimeline(timeline.id);
                            updateMachineStatus(timeline.closest('.machine'));
                        }
                    }
                }
                
                if (isNew) jobsAdded++;
                else jobsUpdated++;
            });
            
            populateProductionFeed();
            document.querySelectorAll('.timeline').forEach(timeline => {
                rescheduleTimelineJobs(timeline.id);
                scaleTimeline(timeline.id);
            });
            
            updateAllMachineStatuses();
            updateAllJobColors();
            updateAllJobTimes();
            updateAllNowIndicators();
            
            showUploadProgress(`PL upload complete: ${jobsAdded} added, ${jobsUpdated} updated`, 100);
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