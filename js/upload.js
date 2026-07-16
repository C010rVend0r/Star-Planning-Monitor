// script-upload.js - SPLIT UPLOAD WITH DELAY
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
// CALCULATE ESTIMATED DATE
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
// SPLIT UPLOAD WITH DELAY - WORKS EVERY TIME
// ============================================================
async function splitUpload(file) {
    console.log('🔥 SPLIT UPLOAD STARTED:', file.name);
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
            // DEDUPLICATE
            // ============================================
            const jobMap = new Map();
            let duplicateCount = 0;
            
            for (const row of rows) {
                if (!row || row.length < 25) continue;
                
                const jobNumber = String(row[0] || '').trim();
                if (!jobNumber) continue;
                
                if (jobMap.has(jobNumber)) {
                    duplicateCount++;
                    continue;
                }
                
                const jobName = String(row[1] || '').trim() || 'Unnamed';
                const newPlat = String(row[2] || '').trim() || '';
                const materialAvailability = String(row[4] || '').trim() || '';
                const planningStatus = String(row[5] || '').trim() || 'Unplanned';
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
                const effectiveStatus = isComplete ? 'Complete' : planningStatus;
                
                jobMap.set(jobNumber, {
                    job_id: jobId,
                    job_number: jobNumber,
                    name: jobName,
                    status: effectiveStatus,
                    aw_status: 'Unknown',
                    raw_aw_status: 'Unknown',
                    planning_status: planningStatus,
                    status_date: new Date(1900, 0, 1).toISOString(),
                    estimated_date: null,
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
            }
            
            const uniqueJobs = Array.from(jobMap.values());
            console.log(`📊 ${uniqueJobs.length} UNIQUE jobs (${duplicateCount} duplicates removed)`);
            
            if (uniqueJobs.length === 0) {
                alert('No valid jobs found!');
                hideUploadProgress();
                return;
            }
            
            // ============================================
            // CLEAR EXISTING DATA
            // ============================================
            const client = initSupabase();
            const startTime = Date.now();
            
            console.log('🧹 Clearing existing data...');
            showUploadProgress('🧹 Clearing existing data...', 15);
            
            // Delete jobs
            const existingJobs = await supabaseLoadAllJobs();
            if (existingJobs && existingJobs.length > 0) {
                for (let i = 0; i < existingJobs.length; i += 200) {
                    const batch = existingJobs.slice(i, i + 200);
                    const ids = batch.map(j => j.job_id);
                    await client.from('jobs').delete().in('job_id', ids);
                }
                console.log(`🗑️ Deleted ${existingJobs.length} existing jobs`);
            }
            
            // Delete PL data
            const existingPL = await supabaseLoadAllPLData();
            if (existingPL && existingPL.length > 0) {
                for (let i = 0; i < existingPL.length; i += 200) {
                    const batch = existingPL.slice(i, i + 200);
                    const ids = batch.map(p => p.job_id);
                    await client.from('pl_database').delete().in('job_id', ids);
                }
                console.log(`🗑️ Deleted ${existingPL.length} existing PL records`);
            }
            
            // Delete AW data
            const existingAW = await supabaseLoadAllAWData();
            if (existingAW && existingAW.length > 0) {
                for (let i = 0; i < existingAW.length; i += 200) {
                    const batch = existingAW.slice(i, i + 200);
                    const ids = batch.map(a => a.job_number);
                    await client.from('aw_data').delete().in('job_number', ids);
                }
                console.log(`🗑️ Deleted ${existingAW.length} existing AW records`);
            }
            
            // ============================================
            // SPLIT UPLOAD - 50 JOBS PER BATCH WITH DELAY
            // ============================================
            console.log(`📤 Uploading ${uniqueJobs.length} jobs in small batches...`);
            showUploadProgress(`📤 Uploading ${uniqueJobs.length} jobs...`, 20);
            
            const BATCH_SIZE = 50; // Small batches = more reliable
            let totalInserted = 0;
            let failedJobs = [];
            
            for (let i = 0; i < uniqueJobs.length; i += BATCH_SIZE) {
                const batch = uniqueJobs.slice(i, i + BATCH_SIZE);
                
                try {
                    const { data: inserted, error } = await client
                        .from('jobs')
                        .upsert(batch, { 
                            onConflict: 'job_number',
                            ignoreDuplicates: false 
                        })
                        .select('job_number');
                    
                    if (error) {
                        console.warn(`⚠️ Batch ${Math.floor(i/BATCH_SIZE)+1} error:`, error.message);
                        // Try individual
                        for (const job of batch) {
                            try {
                                await client
                                    .from('jobs')
                                    .upsert(job, { onConflict: 'job_number' });
                                totalInserted++;
                            } catch (e) {
                                failedJobs.push(job.job_number);
                            }
                        }
                    } else {
                        totalInserted += batch.length;
                        console.log(`✅ Batch ${Math.floor(i/BATCH_SIZE)+1}: ${batch.length} jobs`);
                    }
                    
                } catch (err) {
                    console.warn(`⚠️ Batch ${Math.floor(i/BATCH_SIZE)+1} failed:`, err.message);
                    for (const job of batch) {
                        try {
                            await client
                                .from('jobs')
                                .upsert(job, { onConflict: 'job_number' });
                            totalInserted++;
                        } catch (e) {
                            failedJobs.push(job.job_number);
                        }
                    }
                }
                
                const elapsed = Math.round((Date.now() - startTime) / 1000);
                const percent = Math.min(95, Math.round((totalInserted / uniqueJobs.length) * 100));
                showUploadProgress(`📊 ${totalInserted}/${uniqueJobs.length} jobs (${elapsed}s)`, percent);
                console.log(`✅ ${totalInserted}/${uniqueJobs.length} jobs uploaded (${elapsed}s)`);
                
                // ⚡ DELAY BETWEEN BATCHES - THIS IS THE KEY!
                if (i + BATCH_SIZE < uniqueJobs.length) {
                    await new Promise(r => setTimeout(r, 200));
                }
            }
            
            // ============================================
            // VERIFY
            // ============================================
            const verifyResult = await client
                .from('jobs')
                .select('*', { count: 'exact', head: false });
            
            const actualCount = verifyResult.data?.length || 0;
            const totalTime = Math.round((Date.now() - startTime) / 1000);
            
            console.log(`
╔════════════════════════════════════════════════════════════════╗
║                    ✅🔴🔴🔴🔴 UPLOAD COMPLETE!                        ║
╠════════════════════════════════════════════════════════════════╣
║  📊 Unique jobs in file:  ${uniqueJobs.length}                ║
║  📊 Confirmed in DB:      ${actualCount}                      ║
║  🔄 Duplicates removed:   ${duplicateCount}                   ║
║  ❌ Failed:               ${failedJobs.length}                 ║
║  ⏱️  Time:                ${totalTime} seconds                ║
╚════════════════════════════════════════════════════════════════╝
            `);
            
            if (failedJobs.length > 0) {
                console.log('❌ Failed job numbers:', failedJobs.slice(0, 20));
                if (failedJobs.length > 20) {
                    console.log(`   ... and ${failedJobs.length - 20} more`);
                }
            }
            
            if (actualCount < uniqueJobs.length) {
                console.warn(`⚠️ WARNING: Only ${actualCount} jobs in DB, expected ${uniqueJobs.length}`);
                console.log(`🔄 Missing: ${uniqueJobs.length - actualCount} jobs`);
                console.log('🔄 Try running the upload again - it will skip duplicates.');
            } else {
                console.log('🎉 ALL JOBS UPLOADED SUCCESSFULLY!');
            }
            
            updateUploadStatus('qasem');
            showUploadProgress(`✅ ${actualCount} jobs in database`, 100);
            
            setTimeout(async () => {
                await supabaseSyncAllData();
                populateProductionFeed();
                hideUploadProgress();
                showNotification(`✅ ${actualCount} jobs in database (${duplicateCount} duplicates removed)`, 'success');
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
// HANDLE AW UPLOAD
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
            const detected = detectUploader(sheetNames);
            
            const firstSheet = workbook.Sheets[sheetNames[0]];
            const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });
            
            showUploadProgress('🔄 Processing AW data...', 30);
            
            const rows = jsonData.slice(3);
            let awJobsFound = 0;
            let awJobsSkipped = 0;
            
            const savedFilterStatuses = new Set(filterStatuses);
            const jobsToUpdate = {};
            const awDataToSave = {};
            
            const existingJobs = await supabaseLoadAllJobs();
            const completeJobNumbers = new Set();
            
            if (existingJobs && existingJobs.length > 0) {
                existingJobs.forEach(job => {
                    if (job.planning_status === 'Complete' || job.planning_status === 'Printed') {
                        completeJobNumbers.add(job.job_number);
                    }
                });
            }
            
            for (const row of rows) {
                if (!row || row.length < 10) continue;
                
                const jobNumber = String(row[5] || '').trim();
                const status = String(row[8] || '').trim();
                
                if (!jobNumber) continue;
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
            
            if (Object.keys(awDataToSave).length > 0) {
                await supabaseSaveMultipleAWData(awDataToSave);
            }
            
            if (Object.keys(jobsToUpdate).length > 0) {
                await supabaseSaveMultipleJobs(jobsToUpdate);
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
                showNotification(`✅ Full Data uploaded - ${awJobsFound} updated`, 'success');
            } else {
                if (detected.mahmoud) updateUploadStatus('mahmoud');
                if (detected.raed) updateUploadStatus('raed');
                if (detected.rabia) updateUploadStatus('rabia');
                showNotification(`✅ AW data uploaded - ${awJobsFound} jobs updated`, 'success');
            }
            
            showUploadProgress(`✅ AW complete: ${awJobsFound} updated`, 100);
            
            setTimeout(() => {
                hideUploadProgress();
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
// EXCEL UPLOAD SETUP
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
    
    // PL Upload - SPLIT UPLOAD WITH DELAY
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
                console.log('PL file selected:', file.name);
                splitUpload(file);
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
window.splitUpload = splitUpload;
window.findJobIdByNumber = findJobIdByNumber;
window.calculateEstimatedDate = calculateEstimatedDate;

console.log('✅ Upload status tracking initialized');
