'use strict';

/**
 * Password-protected demo accounts.
 *
 * These credentials are intentionally public: they exist so a reviewer can sign
 * in to the deployed demo without a Firebase account. They are only accepted
 * when demo logins are enabled for the deployment (DEMO_MODE=true or
 * ALLOW_DEMO_LOGIN=true) and never create privileged access on a Firebase-only
 * deployment.
 *
 * Keep the passwords in sync with README.md and the sign-in screen hint.
 */
const DEMO_CREDENTIALS = [
  {
    email: 'student@edu.ac.in',
    password: 'Student@123',
    displayName: 'Aarav Sharma',
    role: 'user',
  },
  {
    email: 'superadmin@admin.com',
    password: 'SuperAdmin@123',
    displayName: 'Daniel Osei',
    role: 'super_admin',
  },
];

const findDemoCredential = (email) =>
  DEMO_CREDENTIALS.find((account) => account.email === String(email || '').toLowerCase()) || null;

module.exports = { DEMO_CREDENTIALS, findDemoCredential };
