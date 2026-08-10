#[cfg(target_os = "windows")]
use std::ptr::null_mut;
#[cfg(target_os = "windows")]
use windows_sys::Win32::Foundation::{CloseHandle, HANDLE};
#[cfg(target_os = "windows")]
use windows_sys::Win32::System::JobObjects::{
    AssignProcessToJobObject, CreateJobObjectW, JobObjectExtendedLimitInformation,
    SetInformationJobObject, JOBOBJECT_EXTENDED_LIMIT_INFORMATION,
    JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE,
};
#[cfg(target_os = "windows")]
use windows_sys::Win32::System::Threading::{OpenProcess, PROCESS_SET_QUOTA, PROCESS_TERMINATE};

#[cfg(target_os = "windows")]
pub struct JobManager {
    job_handle: HANDLE,
}

#[cfg(target_os = "windows")]
unsafe impl Send for JobManager {}
#[cfg(target_os = "windows")]
unsafe impl Sync for JobManager {}

#[cfg(target_os = "windows")]
impl JobManager {
    pub fn new() -> Result<Self, String> {
        unsafe {
            let handle = CreateJobObjectW(null_mut(), std::ptr::null());
            if handle.is_null() {
                return Err("Failed to create Job Object".to_string());
            }

            let mut info: JOBOBJECT_EXTENDED_LIMIT_INFORMATION = std::mem::zeroed();
            info.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;

            let result = SetInformationJobObject(
                handle,
                JobObjectExtendedLimitInformation,
                &info as *const _ as *const std::ffi::c_void,
                std::mem::size_of::<JOBOBJECT_EXTENDED_LIMIT_INFORMATION>() as u32,
            );

            if result == 0 {
                CloseHandle(handle);
                return Err("Failed to set Job Object information".to_string());
            }

            Ok(Self { job_handle: handle })
        }
    }

    pub fn assign(&self, pid: u32) -> Result<(), String> {
        unsafe {
            let process_handle = OpenProcess(PROCESS_SET_QUOTA | PROCESS_TERMINATE, 0, pid);
            if process_handle.is_null() {
                return Err("Failed to OpenProcess for Job Assignment".to_string());
            }

            let result = AssignProcessToJobObject(self.job_handle, process_handle);
            CloseHandle(process_handle);

            if result == 0 {
                return Err("Failed to assign process to Job Object".to_string());
            }
        }
        Ok(())
    }
}

#[cfg(target_os = "windows")]
impl Drop for JobManager {
    fn drop(&mut self) {
        unsafe {
            if !self.job_handle.is_null() {
                CloseHandle(self.job_handle);
            }
        }
    }
}

#[cfg(not(target_os = "windows"))]
pub struct JobManager {}

#[cfg(not(target_os = "windows"))]
impl JobManager {
    pub fn new() -> Result<Self, String> {
        Ok(Self {})
    }
    pub fn assign(&self, _pid: u32) -> Result<(), String> {
        Ok(())
    }
}
