INSERT OR IGNORE INTO departments (id, code, name, location, doctors_json, active, sort_order) VALUES
('gen', 'G', 'General Medicine', 'Ground floor, Block A', '["Dr. Anjali Rao", "Dr. Vikram Menon"]', 1, 1),
('card', 'C', 'Cardiology', 'First floor, Block B', '["Dr. Suresh Iyer", "Dr. Meera Krishnan"]', 1, 2),
('ortho', 'O', 'Orthopaedics', 'First floor, Block A', '["Dr. Arjun Nair", "Dr. Kavya Reddy"]', 1, 3),
('paed', 'P', 'Paediatrics', 'Ground floor, Block C', '["Dr. Lakshmi Prasad", "Dr. Rahul Varma"]', 1, 4),
('derm', 'D', 'Dermatology', 'Second floor, Block B', '["Dr. Farah Siddiqui"]', 1, 5),
('ent', 'E', 'ENT', 'Second floor, Block A', '["Dr. Naveen Kumar", "Dr. Divya Shankar"]', 1, 6);
