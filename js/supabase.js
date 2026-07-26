// supabase.js - Supabase Database Connection
// ============================================================
// SUPABASE CONFIGURATION
// ============================================================

// Actual Supabase credentials from:
// https://supabase.com/dashboard/project/wjnynzazfganrqoacpdp/settings/api

const SUPABASE_URL = 'https://wjnynzazfganrqoacpdp.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_9Oqodws7pAh3RO4xDlgH6Q_FOgf7aWo';

// ⭐ SERVICE ROLE KEY - For admin operations only
// Get this from: Supabase Dashboard > Settings > API > Service role secret
// IMPORTANT: Never expose this in production client-side code!
// For development/testing only.
const SUPABASE_SERVICE_ROLE_KEY = 'YOUR_SERVICE_ROLE_KEY_HERE';

let supabaseClient = null;
let supabaseAdminClient = null;

// ============================================================
// INITIALIZE SUPABASE (Regular client - for normal operations)
// ============================================================
function initSupabase() {
    if (!supabaseClient) {
        supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        console.log('✅ Supabase client initialized');
    }
    return supabaseClient;
}

// ============================================================
// INITIALIZE SUPABASE ADMIN (Service role - for admin operations)
// ============================================================
function initSupabaseAdmin() {
    if (SUPABASE_SERVICE_ROLE_KEY === 'YOUR_SERVICE_ROLE_KEY_HERE') {
        console.warn('⚠️ Service role key not configured!');
        console.warn('📝 Get it from: Supabase Dashboard > Settings > API > Service role secret');
        return null;
    }
    
    if (!supabaseAdminClient) {
        try {
            supabaseAdminClient = supabase.createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
            console.log('✅ Supabase admin client initialized');
        } catch (error) {
            console.error('❌ Failed to initialize admin client:', error);
            return null;
        }
    }
    return supabaseAdminClient;
}

// ============================================================
// CREATE USER WITH ADMIN (Using Service Role Key)
// ============================================================
async function createUserWithAdmin(email, password, displayName, role, uploader = null) {
    console.log('🔐 Creating user with admin privileges...');
    
    const adminClient = initSupabaseAdmin();
    if (!adminClient) {
        console.error('❌ Admin client not available. Service role key not configured.');
        if (typeof showNotification === 'function') {
            showNotification('❌ Admin client not available. Service role key not configured.', 'error');
        }
        return false;
    }
    
    try {
        // Create user using admin API
        const { data: userData, error: userError } = await adminClient.auth.admin.createUser({
            email: email,
            password: password,
            email_confirm: true,
            user_metadata: {
                full_name: displayName,
                first_login: true
            }
        });
        
        if (userError) {
            console.error('❌ User creation error:', userError);
            if (typeof showNotification === 'function') {
                showNotification(`❌ Error: ${userError.message}`, 'error');
            }
            return false;
        }
        
        if (!userData || !userData.user) {
            console.error('❌ Failed to create user - no user data returned');
            if (typeof showNotification === 'function') {
                showNotification('❌ Failed to create user - no user data returned', 'error');
            }
            return false;
        }
        
        const userId = userData.user.id;
        console.log(`✅ User created with ID: ${userId}`);
        
        // Create profile using regular client (now user exists)
        const client = initSupabase();
        const { error: profileError } = await client
            .from('user_profiles')
            .insert({
                user_id: userId,
                email: email,
                display_name: displayName,
                role: role || 'observer',
                uploader: uploader || null,
                is_active: true,
                password_set: true
            });
        
        if (profileError) {
            console.error('❌ Profile creation error:', profileError);
            if (typeof showNotification === 'function') {
                showNotification(`⚠️ User created but profile creation failed: ${profileError.message}`, 'warning');
            }
            return false;
        }
        
        console.log(`✅ User ${email} created with role: ${role || 'observer'}`);
        if (typeof showNotification === 'function') {
            showNotification(`✅ User ${email} created successfully with role: ${role || 'observer'}`, 'success');
        }
        return true;
        
    } catch (error) {
        console.error('❌ Error creating user:', error);
        if (typeof showNotification === 'function') {
            showNotification(`❌ Error: ${error.message}`, 'error');
        }
        return false;
    }
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
            .select('*')
            .order('job_number', { ascending: true });
        
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
        
        const dataToSave = {
            job_number: jobNumber,
            status: awData.status || awData.raw_status || 'Unknown',
            raw_status: awData.raw_status || awData.status || 'Unknown',
            status_date: awData.status_date || awData.statusDate || new Date(1900, 0, 1).toISOString(),
            estimated_date: awData.estimated_date || awData.estimatedDate || null,
            is_from_aw: awData.is_from_aw !== undefined ? awData.is_from_aw : true
        };
        
        const { error } = await client
            .from('aw_data')
            .upsert(dataToSave, { 
                onConflict: 'job_number',
                ignoreDuplicates: false 
            });
        
        if (error) {
            console.error('❌ Error saving AW data:', error);
            return false;
        }
        
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
            status: data.status || data.raw_status || 'Unknown',
            raw_status: data.raw_status || data.status || 'Unknown',
            status_date: data.status_date || data.statusDate || new Date(1900, 0, 1).toISOString(),
            estimated_date: data.estimated_date || data.estimatedDate || null,
            is_from_aw: data.is_from_aw !== undefined ? data.is_from_aw : true
        }));
        
        const { error } = await client
            .from('aw_data')
            .upsert(awArray, { 
                onConflict: 'job_number',
                ignoreDuplicates: false 
            });
        
        if (error) {
            console.error('❌ Error saving AW data:', error);
            return false;
        }
        
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
            start_time: data.start_time || data.startTime,
            end_time: data.end_time || data.endTime,
            timeline_id: data.timeline_id || data.timelineId,
            is_printed: data.is_printed || data.isPrinted || false
        }));
        
        const { error } = await client
            .from('job_schedule')
            .upsert(scheduleArray, { onConflict: 'job_id' });
        
        if (error) {
            console.error('❌ Error saving schedules:', error);
            return false;
        }
        
        console.log(`✅ ${scheduleArray.length} schedules saved to Supabase`);
        return true;
    } catch (error) {
        console.error('❌ Error saving multiple schedules:', error);
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
        
        // Validate inputs
        if (!jobId) {
            console.error('❌ No jobId provided for speed save');
            return false;
        }
        if (typeof speed !== 'number' || speed <= 0) {
            console.error(`❌ Invalid speed value: ${speed}`);
            return false;
        }
        
        // Try to save
        const { data, error } = await client
            .from('job_speeds')
            .upsert({ 
                job_id: jobId, 
                speed: speed,
                updated_at: new Date().toISOString()
            }, { 
                onConflict: 'job_id' 
            });
        
        if (error) {
            console.error(`❌ Supabase save speed error for ${jobId}:`, error);
            return false;
        }
        
        console.log(`✅ Speed ${speed} saved to Supabase for ${jobId}`);
        return true;
    } catch (error) {
        console.error(`❌ Error saving speed for ${jobId}:`, error);
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
    
    // Save the current filter state before clearing data
    const savedFilterStatuses = new Set(filterStatuses);
    
    try {
        // Load all data in parallel
        const [jobs, plData, awDataResult, schedules, speeds, uploadStatus] = await Promise.all([
            supabaseLoadAllJobs(),
            supabaseLoadAllPLData(),
            supabaseLoadAllAWData(),
            supabaseLoadAllSchedules(),
            supabaseLoadAllSpeeds(),
            supabaseGetUploadStatus()
        ]);
        
        // ============================================================
        // STEP 1: Clear existing in-memory data (but preserve references)
        // ============================================================
        // Don't clear jobDatabase completely - we need to preserve jobs
        // but we need to clear PL and AW data to rebuild
        
        // Clear PL data
        Object.keys(plDatabase).forEach(key => delete plDatabase[key]);
        
        // Clear AW data
        Object.keys(window.awData).forEach(key => delete window.awData[key]);
        
        // Clear existing schedules - we'll rebuild from Supabase
        Object.keys(jobSchedule).forEach(key => delete jobSchedule[key]);
        
        // Clear speeds
        Object.keys(jobSpeeds).forEach(key => delete jobSpeeds[key]);
        
        // ============================================================
        // STEP 2: Load jobs from Supabase
        // ============================================================
        let loadedJobCount = 0;
        
        if (jobs && jobs.length > 0) {
            console.log(`📊 Loading ${jobs.length} jobs from Supabase...`);
            
            jobs.forEach(job => {
                const jobId = job.job_id;
                
                // Convert snake_case to camelCase
                const jobData = convertSnakeToCamel(job);
                
                // Store in jobDatabase
                jobDatabase[jobId] = jobData;
                
                // Initialize PL entry if not exists
                if (!plDatabase[jobId]) {
                    plDatabase[jobId] = {};
                }
                
                // Copy relevant fields to PL database
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
                plDatabase[jobId].rawAWStatus = job.raw_aw_status;
                plDatabase[jobId].priority = job.priority;
                plDatabase[jobId].isComplete = job.is_complete || false;
                plDatabase[jobId].isPlanned = job.is_planned || false;
                plDatabase[jobId].isUnplanned = job.is_unplanned || false;
                plDatabase[jobId].newPlat = job.new_plat;
                plDatabase[jobId].materialAvailability = job.material_availability;
                plDatabase[jobId].delivered = job.delivered;
                plDatabase[jobId].delivered2 = job.delivered2;
                plDatabase[jobId].cuttingMethod = job.cutting_method;
                plDatabase[jobId].film = job.film;
                plDatabase[jobId].thickness = job.thickness;
                plDatabase[jobId].materialType = job.material_type;
                plDatabase[jobId].downtime = job.downtime;
                
                loadedJobCount++;
            });
            
            console.log(`✅ Loaded ${loadedJobCount} jobs from Supabase`);
        } else {
            console.log('ℹ️ No jobs found in Supabase');
        }
        
        // ============================================================
        // STEP 3: Load PL data from Supabase
        // ============================================================
        if (plData && plData.length > 0) {
            console.log(`📊 Loading ${plData.length} PL records from Supabase...`);
            
            plData.forEach(pl => {
                const jobId = pl.job_id;
                const plCamel = convertSnakeToCamel(pl);
                
                if (plDatabase[jobId]) {
                    // Merge with existing PL data
                    Object.assign(plDatabase[jobId], plCamel);
                } else {
                    plDatabase[jobId] = plCamel;
                }
            });
            
            console.log(`✅ Loaded ${plData.length} PL records from Supabase`);
        }
        
        // ============================================================
        // STEP 4: Load AW data from Supabase
        // ============================================================
        if (awDataResult && awDataResult.length > 0) {
            console.log(`📊 Loading ${awDataResult.length} AW records from Supabase...`);
            
            awDataResult.forEach(aw => {
                const jobNumber = aw.job_number;
                
                // Store in awData
                window.awData[jobNumber] = {
                    status: aw.status || 'Unknown',
                    rawStatus: aw.raw_status || aw.status || 'Unknown',
                    statusDate: aw.status_date || new Date(1900, 0, 1).toISOString(),
                    estimatedDate: aw.estimated_date || null,
                    isFromAW: aw.is_from_aw !== undefined ? aw.is_from_aw : true
                };
                
                // Also update the job if it exists
                const jobId = findJobIdByNumber(jobNumber);
                if (jobId && jobDatabase[jobId]) {
                    jobDatabase[jobId].awStatus = aw.status || 'Unknown';
                    jobDatabase[jobId].rawAWStatus = aw.raw_status || aw.status || 'Unknown';
                    jobDatabase[jobId].status = aw.status || 'Unknown';
                    jobDatabase[jobId].statusDate = aw.status_date || new Date(1900, 0, 1).toISOString();
                    jobDatabase[jobId].estimatedDate = aw.estimated_date || null;
                    
                    if (plDatabase[jobId]) {
                        plDatabase[jobId].prepressStatus = aw.status || 'Unknown';
                        plDatabase[jobId].rawAWStatus = aw.raw_status || aw.status || 'Unknown';
                        plDatabase[jobId].statusDate = aw.status_date || new Date(1900, 0, 1).toISOString();
                        plDatabase[jobId].estimatedDate = aw.estimated_date || null;
                    }
                }
            });
            
            console.log(`✅ Loaded ${awDataResult.length} AW records from Supabase`);
        }
        
        // ============================================================
        // STEP 5: Load schedules from Supabase (CRITICAL FIX)
        // ============================================================
        if (schedules && schedules.length > 0) {
            console.log(`📊 Loading ${schedules.length} schedules from Supabase...`);
            
            // Get active job IDs (Planned) and completed job IDs
            const activeJobIds = new Set();
            const completeJobIds = new Set();
            const printedJobIds = new Set();
            
            for (const [jobId, data] of Object.entries(jobDatabase)) {
                if (data.planningStatus === 'Complete' || data.isComplete === true) {
                    completeJobIds.add(jobId);
                } else if (data.planningStatus === 'Planned') {
                    activeJobIds.add(jobId);
                }
            }
            
            console.log(`📊 Found ${activeJobIds.size} active jobs, ${completeJobIds.size} completed jobs`);
            
            // Group schedules by timeline
            const schedulesByTimeline = {};
            let loadedCount = 0;
            let skippedCount = 0;
            
            for (const schedule of schedules) {
                const jobId = schedule.job_id;
                
                // Skip if job doesn't exist in database
                if (!jobDatabase[jobId]) {
                    skippedCount++;
                    continue;
                }
                
                // Skip completed jobs that are not printed (they should be removed)
                if (completeJobIds.has(jobId) && !schedule.is_printed) {
                    skippedCount++;
                    console.log(`⏭️ Skipping completed job ${jobId} schedule (not printed)`);
                    continue;
                }
                
                // Skip active jobs that are not planned
                if (!activeJobIds.has(jobId) && !schedule.is_printed && !completeJobIds.has(jobId)) {
                    skippedCount++;
                    continue;
                }
                
                const timelineId = schedule.timeline_id;
                if (!schedulesByTimeline[timelineId]) {
                    schedulesByTimeline[timelineId] = [];
                }
                
                // Store the schedule
                schedulesByTimeline[timelineId].push({
                    jobId: jobId,
                    startTime: new Date(schedule.start_time).getTime(),
                    endTime: new Date(schedule.end_time).getTime(),
                    timelineId: timelineId,
                    isPrinted: schedule.is_printed || false
                });
                
                loadedCount++;
            }
            
            console.log(`📊 Loaded ${loadedCount} schedules (skipped ${skippedCount})`);
            
            // Process each timeline's schedules
            for (const [timelineId, scheduleList] of Object.entries(schedulesByTimeline)) {
                // Separate printed and non-printed jobs
                const printed = scheduleList.filter(s => s.isPrinted === true);
                const nonPrinted = scheduleList.filter(s => s.isPrinted !== true);
                
                // Sort printed jobs by end time (newest first)
                printed.sort((a, b) => b.endTime - a.endTime);
                
                // Keep only the most recent printed job per timeline
                const keptPrinted = printed.slice(0, 1);
                const removedPrinted = printed.slice(1);
                
                removedPrinted.forEach(s => {
                    console.log(`🗑️ Filtered out old printed job ${s.jobId} from ${timelineId}`);
                });
                
                // Combine non-printed and kept printed jobs
                const finalSchedules = [...nonPrinted, ...keptPrinted];
                
                // Store in jobSchedule
                for (const s of finalSchedules) {
                    jobSchedule[s.jobId] = {
                        startTime: s.startTime,
                        endTime: s.endTime,
                        timelineId: s.timelineId,
                        isPrinted: s.isPrinted
                    };
                    
                    // Update job's planning status if it's printed
                    if (s.isPrinted && jobDatabase[s.jobId]) {
                        jobDatabase[s.jobId].planningStatus = 'Complete';
                        jobDatabase[s.jobId].isComplete = true;
                        if (plDatabase[s.jobId]) {
                            plDatabase[s.jobId].planningStatus = 'Complete';
                            plDatabase[s.jobId].isComplete = true;
                        }
                    }
                }
            }
            
            console.log(`✅ Loaded ${Object.keys(jobSchedule).length} schedules from Supabase (filtered)`);
        } else {
            console.log('ℹ️ No schedules found in Supabase');
        }
        
        // ============================================================
        // STEP 6: Load speeds from Supabase
        // ============================================================
        if (speeds && speeds.length > 0) {
            console.log(`📊 Loading ${speeds.length} speeds from Supabase...`);
            
            speeds.forEach(speed => {
                const jobId = speed.job_id;
                jobSpeeds[jobId] = speed.speed;
            });
            
            console.log(`✅ Loaded ${speeds.length} speeds from Supabase`);
        }
        
        // ============================================================
        // STEP 7: Load upload status from Supabase
        // ============================================================
        if (uploadStatus && uploadStatus.length > 0) {
            uploadStatus.forEach(status => {
                if (window.uploadStatus && window.uploadStatus[status.uploader]) {
                    window.uploadStatus[status.uploader].lastUpdated = status.last_updated ? new Date(status.last_updated) : null;
                    window.uploadStatus[status.uploader].status = status.status || 'pending';
                }
            });
            console.log(`✅ Loaded upload status from Supabase`);
        }
        
        // ============================================================
        // STEP 8: Restore filter state
        // ============================================================
        filterStatuses = savedFilterStatuses;
        
        // Re-apply filters
        setTimeout(() => {
            if (typeof syncFilterCheckboxes === 'function') {
                try { syncFilterCheckboxes(); } catch (e) {}
            }
            if (typeof applyFilter === 'function') {
                try { applyFilter(); } catch (e) {}
            }
            if (typeof updateFilterBadge === 'function') {
                try { updateFilterBadge(); } catch (e) {}
            }
            if (typeof updateStatistics === 'function') {
                try { updateStatistics(); } catch (e) {}
            }
        }, 100);
        
        // ============================================================
        // STEP 9: Restore schedules to timelines (CRITICAL)
        // ============================================================
        setTimeout(() => {
            console.log('🔄 Restoring schedules to timelines...');
            
            // Check if we have any schedules in memory
            const scheduleEntries = Object.entries(jobSchedule);
            if (scheduleEntries.length > 0) {
                console.log(`📊 Found ${scheduleEntries.length} schedules to restore`);
                
                // Update each job's time display
                for (const [jobId, schedule] of scheduleEntries) {
                    const jobElement = document.querySelector(`.job[data-job-id="${jobId}"]`);
                    if (jobElement) {
                        updateJobTimeDisplay(jobId);
                    }
                }
                
                // Refresh all timelines
                document.querySelectorAll('.timeline').forEach(timeline => {
                    const container = timeline.closest('.timeline-container');
                    if (container) {
                        container.querySelectorAll('.timeline-ruler, .timeline-date-header').forEach(el => el.remove());
                    }
                    delete timelineStateCache[timeline.id];
                    
                    // Scale and update
                    scaleTimeline(timeline.id);
                    updateJobColors(timeline.id);
                    updateNowIndicatorPosition(timeline);
                    
                    // Ensure printed jobs are at the beginning
                    sortPrintedJobs(timeline);
                });
                
                // Update all visual elements
                updateAllMachineStatuses();
                updateAllJobColors();
                updateAllJobTimes();
                updateAllNowIndicators();
                applySmartZoom();
                
                setTimeout(updateAllTimelineScrollPositions, 300);
                
                console.log('✅ Schedules restored to timelines');
            } else {
                console.log('ℹ️ No schedules to restore');
            }
        }, 500);
        
        // ============================================================
        // STEP 10: Log completion
        // ============================================================
        console.log(`✅ Sync complete! Loaded ${loadedJobCount} jobs, ${Object.keys(jobSchedule).length} schedules, ${Object.keys(jobSpeeds).length} speeds`);
        
        return true;
        
    } catch (error) {
        console.error('❌ Error syncing data from Supabase:', error);
        
        // Restore filter state even on error
        filterStatuses = savedFilterStatuses;
        setTimeout(() => {
            if (typeof syncFilterCheckboxes === 'function') {
                try { syncFilterCheckboxes(); } catch(e) {}
            }
            if (typeof applyFilter === 'function') {
                try { applyFilter(); } catch(e) {}
            }
            if (typeof updateFilterBadge === 'function') {
                try { updateFilterBadge(); } catch(e) {}
            }
        }, 100);
        
        return false;
    }
}

// ============================================================
// HELPER FUNCTIONS
// ============================================================

function convertSnakeToCamel(obj) {
    const result = {};
    for (const [key, value] of Object.entries(obj)) {
        let camelKey;
        // Special cases
        if (key === 'raw_aw_status') {
            camelKey = 'rawAWStatus';
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

function convertCamelToSnake(obj) {
    const result = {};
    for (const [key, value] of Object.entries(obj)) {
        let snakeKey;
        // Special cases for specific fields
        if (key === 'rawAWStatus') {
            snakeKey = 'raw_aw_status';
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
            if (!data.startTime || !data.endTime) continue;
            
            schedulesToSave[jobId] = {
                start_time: new Date(data.startTime).toISOString(),
                end_time: new Date(data.endTime).toISOString(),
                timeline_id: data.timelineId || '',
                is_printed: data.isPrinted || false
            };
        }
        
        if (Object.keys(schedulesToSave).length > 0) {
            console.log(`💾 Saving ${Object.keys(schedulesToSave).length} schedules...`);
            const success = await supabaseSaveMultipleSchedules(schedulesToSave);
            if (success) {
                console.log('✅ Schedules saved successfully');
            } else {
                console.warn('⚠️ Failed to save schedules');
            }
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
// FIND JOB ID BY NUMBER
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

// ============================================================
// EXPOSE FUNCTIONS TO WINDOW
// ============================================================
window.initSupabase = initSupabase;
window.initSupabaseAdmin = initSupabaseAdmin;
window.createUserWithAdmin = createUserWithAdmin;
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
window.findJobIdByNumber = findJobIdByNumber;

console.log('✅ supabase.js loaded');
