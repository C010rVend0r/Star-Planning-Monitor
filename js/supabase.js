// supabase.js - Supabase Database Connection
// ============================================================
// SUPABASE CONFIGURATION
// ============================================================

// actual Supabase credentials from:
// https://supabase.com/dashboard/project/jeqbpugoicguypqapuwg/settings/api

const SUPABASE_URL = 'https://jeqbpugoicguypqapuwg.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_Rk2qsV6RwoBDzXNoYKoKfw_ur9D3j4l'; // publishable key (not the secret key)

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
                // Convert snake_case to camelCase for compatibility
                jobDatabase[jobId] = convertSnakeToCamel(job);
                // Also store original snake_case version for PL data
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
        
        // Load PL data (additional fields)
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
        
        // Load schedules
        if (schedules) {
            schedules.forEach(schedule => {
                const jobId = schedule.job_id;
                jobSchedule[jobId] = {
                    startTime: new Date(schedule.start_time).getTime(),
                    endTime: new Date(schedule.end_time).getTime(),
                    timelineId: schedule.timeline_id,
                    isPrinted: schedule.is_printed || false
                };
            });
            console.log(`✅ Loaded ${schedules.length} schedules from Supabase`);
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
function convertSnakeToCamel(obj) {
    const result = {};
    for (const [key, value] of Object.entries(obj)) {
        const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
        result[camelKey] = value;
    }
    return result;
}

function convertCamelToSnake(obj) {
    const result = {};
    for (const [key, value] of Object.entries(obj)) {
        const snakeKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
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