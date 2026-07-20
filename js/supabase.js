// supabase.js - Supabase Database Connection
// ============================================================
// SUPABASE CONFIGURATION
// ============================================================

// actual Supabase credentials from:
// https://supabase.com/dashboard/project/jeqbpugoicguypqapuwg/settings/api

const SUPABASE_URL = 'https://wjnynzazfganrqoacpdp.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_9Oqodws7pAh3RO4xDlgH6Q_FOgf7aWo'; // publishable key (not the secret key)

let supabaseClient = null;

// ============================================================
// INITIALIZE SUPABASE
// ============================================================
function initSupabase() {
    if (!supabaseClient) {
        supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        console.log('✅ Supabase client initialized');
    }
    return supabaseClient;
}

// ============================================================
// DATABASE OPERATIONS
// ============================================================

// ---------- JOBS ----------
async function supabaseLoadAllJobs() {
    try {
        const client = initSupabase();
        const { data, error } = await client
            .from('jobs')
            .select('*')
            .order('job_number', { ascending: true });
        
        if (error) throw error;
        return data;
    } catch (error) {
        console.error('❌ Error loading jobs:', error);
        return null;
    }
}

async function supabaseGetJob(jobId) {
    try {
        const client = initSupabase();
        const { data, error } = await client
            .from('jobs')
            .select('*')
            .eq('job_id', jobId)
            .single();
        
        if (error) throw error;
        return data;
    } catch (error) {
        console.error('❌ Error getting job:', error);
        return null;
    }
}

async function supabaseGetJobByNumber(jobNumber) {
    try {
        const client = initSupabase();
        const { data, error } = await client
            .from('jobs')
            .select('*')
            .eq('job_number', jobNumber)
            .single();
        
        if (error) throw error;
        return data;
    } catch (error) {
        return null; // Not found is okay
    }
}

async function supabaseSaveJob(jobId, jobData) {
    try {
        const client = initSupabase();
        
        // Check if job exists
        const existing = await supabaseGetJob(jobId);
        
        let result;
        if (existing) {
            // Update
            result = await client
                .from('jobs')
                .update(jobData)
                .eq('job_id', jobId);
        } else {
            // Insert
            result = await client
                .from('jobs')
                .insert({ job_id: jobId, ...jobData });
        }
        
        if (result.error) throw result.error;
        console.log(`✅ Job ${jobId} saved to Supabase`);
        return true;
    } catch (error) {
        console.error('❌ Error saving job:', error);
        return false;
    }
}

async function supabaseSaveMultipleJobs(jobs) {
    try {
        const client = initSupabase();
        
        // Use upsert for batch operations
        const jobArray = Object.entries(jobs).map(([jobId, data]) => ({
            job_id: jobId,
            ...data
        }));
        
        const { error } = await client
            .from('jobs')
            .upsert(jobArray, { onConflict: 'job_id' });
        
        if (error) throw error;
        console.log(`✅ ${jobArray.length} jobs saved to Supabase`);
        return true;
    } catch (error) {
        console.error('❌ Error saving multiple jobs:', error);
        return false;
    }
}

async function supabaseDeleteJob(jobId) {
    try {
        const client = initSupabase();
        const { error } = await client
            .from('jobs')
            .delete()
            .eq('job_id', jobId);
        
        if (error) throw error;
        console.log(`✅ Job ${jobId} deleted from Supabase`);
        return true;
    } catch (error) {
        console.error('❌ Error deleting job:', error);
        return false;
    }
}

// ---------- PL DATABASE ----------
async function supabaseLoadAllPLData() {
    try {
        const client = initSupabase();
        const { data, error } = await client
            .from('pl_database')
            .select('*')
            .order('job_number', { ascending: true });
        
        if (error) throw error;
        return data;
    } catch (error) {
        console.error('❌ Error loading PL data:', error);
        return null;
    }
}

async function supabaseSavePLData(jobId, plData) {
    try {
        const client = initSupabase();
        const { error } = await client
            .from('pl_database')
            .upsert({ job_id: jobId, ...plData }, { onConflict: 'job_id' });
        
        if (error) throw error;
        console.log(`✅ PL data for ${jobId} saved to Supabase`);
        return true;
    } catch (error) {
        console.error('❌ Error saving PL data:', error);
        return false;
    }
}

// ---------- AW DATA ----------
async function supabaseLoadAllAWData() {
    try {
        const client = initSupabase();
        const { data, error } = await client
            .from('aw_data')
            .select('*');
        
        if (error) throw error;
        return data;
    } catch (error) {
        console.error('❌ Error loading AW data:', error);
        return null;
    }
}

async function supabaseSaveAWData(jobNumber, awData) {
    try {
        const client = initSupabase();
        const { error } = await client
            .from('aw_data')
            .upsert({ job_number: jobNumber, ...awData }, { onConflict: 'job_number' });
        
        if (error) throw error;
        console.log(`✅ AW data for ${jobNumber} saved to Supabase`);
        return true;
    } catch (error) {
        console.error('❌ Error saving AW data:', error);
        return false;
    }
}

async function supabaseSaveMultipleAWData(awDataMap) {
    try {
        const client = initSupabase();
        const awArray = Object.entries(awDataMap).map(([jobNumber, data]) => ({
            job_number: jobNumber,
            ...data
        }));
        
        const { error } = await client
            .from('aw_data')
            .upsert(awArray, { onConflict: 'job_number' });
        
        if (error) throw error;
        console.log(`✅ ${awArray.length} AW records saved to Supabase`);
        return true;
    } catch (error) {
        console.error('❌ Error saving multiple AW data:', error);
        return false;
    }
}

// ---------- JOB SCHEDULE ----------
async function supabaseLoadAllSchedules() {
    try {
        const client = initSupabase();
        const { data, error } = await client
            .from('job_schedule')
            .select('*');
        
        if (error) throw error;
        return data;
    } catch (error) {
        console.error('❌ Error loading schedules:', error);
        return null;
    }
}

async function supabaseSaveSchedule(jobId, scheduleData) {
    try {
        const client = initSupabase();
        const { error } = await client
            .from('job_schedule')
            .upsert({ job_id: jobId, ...scheduleData }, { onConflict: 'job_id' });
        
        if (error) throw error;
        return true;
    } catch (error) {
        console.error('❌ Error saving schedule:', error);
        return false;
    }
}

async function supabaseSaveMultipleSchedules(schedules) {
    try {
        const client = initSupabase();
        const scheduleArray = Object.entries(schedules).map(([jobId, data]) => ({
            job_id: jobId,
            ...data
        }));
        
        const { error } = await client
            .from('job_schedule')
            .upsert(scheduleArray, { onConflict: 'job_id' });
        
        if (error) throw error;
        return true;
    } catch (error) {
        console.error('❌ Error saving schedules:', error);
        return false;
    }
}

async function supabaseDeleteSchedule(jobId) {
    try {
        const client = initSupabase();
        const { error } = await client
            .from('job_schedule')
            .delete()
            .eq('job_id', jobId);
        
        if (error) throw error;
        return true;
    } catch (error) {
        console.error('❌ Error deleting schedule:', error);
        return false;
    }
}

// ---------- JOB SPEEDS ----------
async function supabaseLoadAllSpeeds() {
    try {
        const client = initSupabase();
        const { data, error } = await client
            .from('job_speeds')
            .select('*');
        
        if (error) throw error;
        return data;
    } catch (error) {
        console.error('❌ Error loading speeds:', error);
        return null;
    }
}

async function supabaseSaveSpeed(jobId, speed) {
    try {
        const client = initSupabase();
        const { error } = await client
            .from('job_speeds')
            .upsert({ job_id: jobId, speed: speed }, { onConflict: 'job_id' });
        
        if (error) throw error;
        return true;
    } catch (error) {
        console.error('❌ Error saving speed:', error);
        return false;
    }
}

// ---------- UPLOAD STATUS ----------
async function supabaseGetUploadStatus() {
    try {
        const client = initSupabase();
        const { data, error } = await client
            .from('upload_status')
            .select('*');
        
        if (error) throw error;
        return data;
    } catch (error) {
        console.error('❌ Error getting upload status:', error);
        return null;
    }
}

async function supabaseUpdateUploadStatus(uploader, status) {
    try {
        const client = initSupabase();
        const { error } = await client
            .from('upload_status')
            .upsert({ 
                uploader: uploader, 
                status: status,
                last_updated: new Date().toISOString()
            }, { onConflict: 'uploader' });
        
        if (error) throw error;
        return true;
    } catch (error) {
        console.error(`❌ Error updating upload status for ${uploader}:`, error);
        return false;
    }
}

// ---------- SYSTEM CONFIG ----------
async function supabaseGetConfig(configKey) {
    try {
        const client = initSupabase();
        const { data, error } = await client
            .from('system_config')
            .select('config_value')
            .eq('config_key', configKey)
            .single();
        
        if (error) throw error;
        return data?.config_value;
    } catch (error) {
        console.error('❌ Error getting config:', error);
        return null;
    }
}

async function supabaseSetConfig(configKey, configValue) {
    try {
        const client = initSupabase();
        const { error } = await client
            .from('system_config')
            .upsert({ 
                config_key: configKey, 
                config_value: configValue 
            }, { onConflict: 'config_key' });
        
        if (error) throw error;
        return true;
    } catch (error) {
        console.error('❌ Error setting config:', error);
        return false;
    }
}
async function supabaseSaveMultipleSchedules(schedules) {
    try {
        const client = initSupabase();
        const scheduleArray = Object.entries(schedules).map(([jobId, data]) => ({
            job_id: jobId,
            start_time: data.start_time,
            end_time: data.end_time,
            timeline_id: data.timeline_id,
            is_printed: data.is_printed || false
        }));
        
        const { error } = await client
            .from('job_schedule')
            .upsert(scheduleArray, { onConflict: 'job_id' });
        
        if (error) throw error;
        return true;
    } catch (error) {
        console.error('❌ Error saving schedules:', error);
        return false;
    }
}

// Also expose it
window.supabaseSaveMultipleSchedules = supabaseSaveMultipleSchedules;

// ============================================================
// SYNC FUNCTIONS - Load all data from Supabase
// ============================================================
async function supabaseSyncAllData() {
    console.log('🔄 Syncing all data from Supabase...');
    
    try {
        // Load all data in parallel
        const [jobs, plData, awData, schedules, speeds, uploadStatus] = await Promise.all([
            supabaseLoadAllJobs(),
            supabaseLoadAllPLData(),
            supabaseLoadAllAWData(),
            supabaseLoadAllSchedules(),
            supabaseLoadAllSpeeds(),
            supabaseGetUploadStatus()
        ]);
        
        // Clear existing in-memory data
        Object.keys(jobDatabase).forEach(key => delete jobDatabase[key]);
        Object.keys(plDatabase).forEach(key => delete plDatabase[key]);
        Object.keys(awData).forEach(key => delete awData[key]);
        Object.keys(jobSchedule).forEach(key => delete jobSchedule[key]);
        Object.keys(jobSpeeds).forEach(key => delete jobSpeeds[key]);
        
        // Load jobs
        if (jobs) {
            jobs.forEach(job => {
                const jobId = job.job_id;
                jobDatabase[jobId] = convertSnakeToCamel(job);
                if (!plDatabase[jobId]) {
                    plDatabase[jobId] = {};
                }
                plDatabase[jobId].jobNumber = job.job_number;
                plDatabase[jobId].jobName = job.name;
                plDatabase[jobId].planningStatus = job.planning_status;
                plDatabase[jobId].machine = job.machine;
                plDatabase[jobId].machineSpeed = job.machine_speed;
                plDatabase[jobId].meters = job.meters;
                plDatabase[jobId].setupTime = job.setup_time;
                plDatabase[jobId].statusDate = job.status_date;
                plDatabase[jobId].estimatedDate = job.estimated_date;
                plDatabase[jobId].prepressStatus = job.aw_status;
            });
            console.log(`✅ Loaded ${jobs.length} jobs from Supabase`);
        }
        
        // Load PL data
        if (plData) {
            plData.forEach(pl => {
                const jobId = pl.job_id;
                if (plDatabase[jobId]) {
                    Object.assign(plDatabase[jobId], convertSnakeToCamel(pl));
                } else {
                    plDatabase[jobId] = convertSnakeToCamel(pl);
                }
            });
            console.log(`✅ Loaded ${plData.length} PL records from Supabase`);
        }
        
        // Load AW data
        if (awData) {
            awData.forEach(aw => {
                const jobNumber = aw.job_number;
                awData[jobNumber] = convertSnakeToCamel(aw);
            });
            console.log(`✅ Loaded ${awData.length} AW records from Supabase`);
        }
        
        // ⭐ Load schedules - KEEP ONLY THE MOST RECENT PRINTED JOB PER TIMELINE
        if (schedules) {
            // Group schedules by timeline
            const schedulesByTimeline = {};
            schedules.forEach(schedule => {
                const timelineId = schedule.timeline_id;
                if (!schedulesByTimeline[timelineId]) {
                    schedulesByTimeline[timelineId] = [];
                }
                schedulesByTimeline[timelineId].push({
                    jobId: schedule.job_id,
                    startTime: new Date(schedule.start_time).getTime(),
                    endTime: new Date(schedule.end_time).getTime(),
                    timelineId: timelineId,
                    isPrinted: schedule.is_printed || false
                });
            });
            
            // For each timeline, keep only the most recent printed job
            for (const [timelineId, schedulesList] of Object.entries(schedulesByTimeline)) {
                // Separate printed and non-printed
                const printed = schedulesList.filter(s => s.isPrinted);
                const nonPrinted = schedulesList.filter(s => !s.isPrinted);
                
                // Sort printed by end time (most recent first)
                printed.sort((a, b) => b.endTime - a.endTime);
                
                // Keep only the most recent printed job
                const keptPrinted = printed.slice(0, 1);
                const removedPrinted = printed.slice(1);
                
                // Log removed jobs
                removedPrinted.forEach(s => {
                    console.log(`🗑️ Filtered out old printed job ${s.jobId} from ${timelineId}`);
                });
                
                // Add all non-printed and the one kept printed job
                const finalSchedules = [...nonPrinted, ...keptPrinted];
                finalSchedules.forEach(s => {
                    jobSchedule[s.jobId] = {
                        startTime: s.startTime,
                        endTime: s.endTime,
                        timelineId: s.timelineId,
                        isPrinted: s.isPrinted
                    };
                });
            }
            
            console.log(`✅ Loaded ${Object.keys(jobSchedule).length} schedules from Supabase (filtered to 1 printed per timeline)`);
        }
        
        // Load speeds
        if (speeds) {
            speeds.forEach(speed => {
                const jobId = speed.job_id;
                jobSpeeds[jobId] = speed.speed;
            });
            console.log(`✅ Loaded ${speeds.length} speeds from Supabase`);
        }
        
        // Load upload status
        if (uploadStatus) {
            uploadStatus.forEach(status => {
                if (window.uploadStatus && window.uploadStatus[status.uploader]) {
                    window.uploadStatus[status.uploader].lastUpdated = status.last_updated;
                    window.uploadStatus[status.uploader].status = status.status;
                }
            });
            console.log(`✅ Loaded upload status from Supabase`);
        }
        
        console.log('✅ Sync complete!');
        return true;
        
    } catch (error) {
        console.error('❌ Error syncing data from Supabase:', error);
        return false;
    }
}

// ============================================================
// HELPER FUNCTIONS
// ============================================================
// supabase.js - Fix convertSnakeToCamel

// supabase.js - Fix convertSnakeToCamel

function convertSnakeToCamel(obj) {
    const result = {};
    for (const [key, value] of Object.entries(obj)) {
        let camelKey;
        // Special cases
        if (key === 'raw_aw_status') {
            camelKey = 'rawAWStatus'; // ✅ CORRECT
        } else if (key === 'aw_status') {
            camelKey = 'awStatus';
        } else if (key === 'is_unplanned') {
            camelKey = 'isUnplanned';
        } else if (key === 'planning_status') {
            camelKey = 'planningStatus';
        } else if (key === 'status_date') {
            camelKey = 'statusDate';
        } else if (key === 'estimated_date') {
            camelKey = 'estimatedDate';
        } else if (key === 'machine_speed') {
            camelKey = 'machineSpeed';
        } else if (key === 'setup_time') {
            camelKey = 'setupTime';
        } else if (key === 'required_time') {
            camelKey = 'requiredTime';
        } else if (key === 'planned_speed') {
            camelKey = 'plannedSpeed';
        } else if (key === 'actual_speed') {
            camelKey = 'actualSpeed';
        } else if (key === 'planned_setup') {
            camelKey = 'plannedSetup';
        } else if (key === 'actual_setup') {
            camelKey = 'actualSetup';
        } else if (key === 'printing_duration') {
            camelKey = 'printingDuration';
        } else if (key === 'cutting_method') {
            camelKey = 'cuttingMethod';
        } else if (key === 'material_type') {
            camelKey = 'materialType';
        } else if (key === 'material_availability') {
            camelKey = 'materialAvailability';
        } else if (key === 'job_number') {
            camelKey = 'jobNumber';
        } else if (key === 'job_name') {
            camelKey = 'jobName';
        } else if (key === 'new_plat') {
            camelKey = 'newPlat';
        } else if (key === 'prepress_status') {
            camelKey = 'prepressStatus';
        } else if (key === 'is_complete') {
            camelKey = 'isComplete';
        } else if (key === 'is_planned') {
            camelKey = 'isPlanned';
        } else if (key === 'is_deleted') {
            camelKey = 'isDeleted';
        } else if (key === 'is_hold') {
            camelKey = 'isHold';
        } else if (key === 'delivered2') {
            camelKey = 'delivered2';
        } else if (key === 'color') {
            camelKey = 'color';
        } else if (key === 'priority') {
            camelKey = 'priority';
        } else if (key === 'setup') {
            camelKey = 'setup';
        } else if (key === 'quantity') {
            camelKey = 'quantity';
        } else if (key === 'status') {
            camelKey = 'status';
        } else if (key === 'name') {
            camelKey = 'name';
        } else if (key === 'machine') {
            camelKey = 'machine';
        } else if (key === 'delivered') {
            camelKey = 'delivered';
        } else if (key === 'film') {
            camelKey = 'film';
        } else if (key === 'thickness') {
            camelKey = 'thickness';
        } else if (key === 'downtime') {
            camelKey = 'downtime';
        } else {
            // Default conversion
            camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
        }
        result[camelKey] = value;
    }
    return result;
}

// supabase.js - Fix convertCamelToSnake
// supabase.js - Fix convertCamelToSnake

function convertCamelToSnake(obj) {
    const result = {};
    for (const [key, value] of Object.entries(obj)) {
        let snakeKey;
        // Special cases for specific fields
        if (key === 'rawAWStatus') {
            snakeKey = 'raw_aw_status'; // ✅ CORRECT: raw_aw_status
        } else if (key === 'awStatus') {
            snakeKey = 'aw_status';
        } else if (key === 'isUnprinted') {
            snakeKey = 'is_unplanned';
        } else if (key === 'isUnplanned') {
            snakeKey = 'is_unplanned';
        } else if (key === 'planningStatus') {
            snakeKey = 'planning_status';
        } else if (key === 'statusDate') {
            snakeKey = 'status_date';
        } else if (key === 'estimatedDate') {
            snakeKey = 'estimated_date';
        } else if (key === 'machineSpeed') {
            snakeKey = 'machine_speed';
        } else if (key === 'setupTime') {
            snakeKey = 'setup_time';
        } else if (key === 'requiredTime') {
            snakeKey = 'required_time';
        } else if (key === 'plannedSpeed') {
            snakeKey = 'planned_speed';
        } else if (key === 'actualSpeed') {
            snakeKey = 'actual_speed';
        } else if (key === 'plannedSetup') {
            snakeKey = 'planned_setup';
        } else if (key === 'actualSetup') {
            snakeKey = 'actual_setup';
        } else if (key === 'printingDuration') {
            snakeKey = 'printing_duration';
        } else if (key === 'cuttingMethod') {
            snakeKey = 'cutting_method';
        } else if (key === 'materialType') {
            snakeKey = 'material_type';
        } else if (key === 'materialAvailability') {
            snakeKey = 'material_availability';
        } else if (key === 'jobNumber') {
            snakeKey = 'job_number';
        } else if (key === 'jobName') {
            snakeKey = 'job_name';
        } else if (key === 'newPlat') {
            snakeKey = 'new_plat';
        } else if (key === 'prepressStatus') {
            snakeKey = 'prepress_status';
        } else if (key === 'isComplete') {
            snakeKey = 'is_complete';
        } else if (key === 'isPlanned') {
            snakeKey = 'is_planned';
        } else if (key === 'isDeleted') {
            snakeKey = 'is_deleted';
        } else if (key === 'isHold') {
            snakeKey = 'is_hold';
        } else if (key === 'color') {
            snakeKey = 'color';
        } else if (key === 'delivered') {
            snakeKey = 'delivered';
        } else if (key === 'delivered2') {
            snakeKey = 'delivered2';
        } else if (key === 'film') {
            snakeKey = 'film';
        } else if (key === 'thickness') {
            snakeKey = 'thickness';
        } else if (key === 'downtime') {
            snakeKey = 'downtime';
        } else if (key === 'machine') {
            snakeKey = 'machine';
        } else if (key === 'priority') {
            snakeKey = 'priority';
        } else if (key === 'setup') {
            snakeKey = 'setup';
        } else if (key === 'quantity') {
            snakeKey = 'quantity';
        } else if (key === 'status') {
            snakeKey = 'status';
        } else if (key === 'name') {
            snakeKey = 'name';
        } else {
            // Default conversion
            snakeKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
        }
        result[snakeKey] = value;
    }
    return result;
}

// ============================================================
// AUTO-SAVE FUNCTIONS
// ============================================================
let autoSaveTimeout = null;
let pendingChanges = false;

function scheduleAutoSave() {
    if (autoSaveTimeout) {
        clearTimeout(autoSaveTimeout);
    }
    pendingChanges = true;
    autoSaveTimeout = setTimeout(async () => {
        if (pendingChanges) {
            await autoSaveAllData();
            pendingChanges = false;
        }
    }, 5000);
}

async function autoSaveAllData() {
    console.log('💾 Auto-saving data to Supabase...');
    
    try {
        // Save jobs
        const jobsToSave = {};
        for (const [jobId, data] of Object.entries(jobDatabase)) {
            jobsToSave[jobId] = convertCamelToSnake(data);
            // Ensure job_id is set
            jobsToSave[jobId].job_id = jobId;
        }
        if (Object.keys(jobsToSave).length > 0) {
            await supabaseSaveMultipleJobs(jobsToSave);
        }
        
        // Save PL data
        for (const [jobId, data] of Object.entries(plDatabase)) {
            if (data && Object.keys(data).length > 0) {
                await supabaseSavePLData(jobId, convertCamelToSnake(data));
            }
        }
        
        // Save schedules
        const schedulesToSave = {};
        for (const [jobId, data] of Object.entries(jobSchedule)) {
            schedulesToSave[jobId] = {
                start_time: new Date(data.startTime).toISOString(),
                end_time: new Date(data.endTime).toISOString(),
                timeline_id: data.timelineId,
                is_printed: data.isPrinted || false
            };
        }
        if (Object.keys(schedulesToSave).length > 0) {
            await supabaseSaveMultipleSchedules(schedulesToSave);
        }
        
        // Save speeds
        for (const [jobId, speed] of Object.entries(jobSpeeds)) {
            await supabaseSaveSpeed(jobId, speed);
        }
        
        console.log('✅ Auto-save complete!');
    } catch (error) {
        console.error('❌ Auto-save error:', error);
    }
}

// ============================================================
// EXPOSE FUNCTIONS TO WINDOW
// ============================================================
window.initSupabase = initSupabase;
window.supabaseSyncAllData = supabaseSyncAllData;
window.supabaseLoadAllJobs = supabaseLoadAllJobs;
window.supabaseGetJob = supabaseGetJob;
window.supabaseGetJobByNumber = supabaseGetJobByNumber;
window.supabaseSaveJob = supabaseSaveJob;
window.supabaseSaveMultipleJobs = supabaseSaveMultipleJobs;
window.supabaseDeleteJob = supabaseDeleteJob;
window.supabaseLoadAllPLData = supabaseLoadAllPLData;
window.supabaseSavePLData = supabaseSavePLData;
window.supabaseLoadAllAWData = supabaseLoadAllAWData;
window.supabaseSaveAWData = supabaseSaveAWData;
window.supabaseSaveMultipleAWData = supabaseSaveMultipleAWData;
window.supabaseLoadAllSchedules = supabaseLoadAllSchedules;
window.supabaseSaveSchedule = supabaseSaveSchedule;
window.supabaseSaveMultipleSchedules = supabaseSaveMultipleSchedules;
window.supabaseDeleteSchedule = supabaseDeleteSchedule;
window.supabaseLoadAllSpeeds = supabaseLoadAllSpeeds;
window.supabaseSaveSpeed = supabaseSaveSpeed;
window.supabaseGetUploadStatus = supabaseGetUploadStatus;
window.supabaseUpdateUploadStatus = supabaseUpdateUploadStatus;
window.supabaseGetConfig = supabaseGetConfig;
window.supabaseSetConfig = supabaseSetConfig;
window.scheduleAutoSave = scheduleAutoSave;
window.autoSaveAllData = autoSaveAllData;
window.convertSnakeToCamel = convertSnakeToCamel;
window.convertCamelToSnake = convertCamelToSnake;

console.log('✅ supabase.js loaded');
