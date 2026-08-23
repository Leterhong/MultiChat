'use strict';

// tsx derives its temporary directory from process.geteuid() on Unix and
// os.userInfo() on Windows. Some managed Windows runtimes return ENOMEM from
// uv_os_get_passwd; a stable local identifier avoids that platform failure.
if (process.platform === 'win32' && typeof process.geteuid !== 'function') {
  process.geteuid = () => 0;
}
