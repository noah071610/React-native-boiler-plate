ALTER TABLE `expenses` ADD `used_by` text REFERENCES participants(id);
