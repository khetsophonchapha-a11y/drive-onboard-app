-- Migration: Assign 'god' role to specific super-administrator accounts
UPDATE users SET role = 'god' WHERE email IN ('p.pongsada@gmail.com', 'tangnam15573@hotmail.com');
