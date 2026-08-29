USE problearn;

SET FOREIGN_KEY_CHECKS = 0;

-- ============================================================
-- TOPICS
-- ============================================================

CREATE TABLE IF NOT EXISTS `topics` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(255) NOT NULL,
    `description` TEXT NULL,
    `created_at` TIMESTAMP NULL DEFAULT NULL,
    `updated_at` TIMESTAMP NULL DEFAULT NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `topics_name_unique` (`name`)
) ENGINE=InnoDB
DEFAULT CHARSET=utf8mb4
COLLATE=utf8mb4_unicode_ci;


-- ============================================================
-- QUESTIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS `questions` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `topic_id` BIGINT UNSIGNED NOT NULL,
    `question` TEXT NOT NULL,
    `choice_a` VARCHAR(500) NOT NULL,
    `choice_b` VARCHAR(500) NOT NULL,
    `choice_c` VARCHAR(500) NOT NULL,
    `choice_d` VARCHAR(500) NOT NULL,
    `correct_answer` ENUM('A','B','C','D') NOT NULL,
    `explanation` TEXT NULL,
    `difficulty` ENUM('easy','medium','hard') NOT NULL DEFAULT 'easy',
    `points` INT UNSIGNED NOT NULL DEFAULT 1,
    `created_at` TIMESTAMP NULL DEFAULT NULL,
    `updated_at` TIMESTAMP NULL DEFAULT NULL,

    PRIMARY KEY (`id`),

    KEY `questions_topic_id_foreign` (`topic_id`),

    CONSTRAINT `questions_topic_id_foreign`
        FOREIGN KEY (`topic_id`)
        REFERENCES `topics` (`id`)
        ON DELETE CASCADE
        ON UPDATE CASCADE
) ENGINE=InnoDB
DEFAULT CHARSET=utf8mb4
COLLATE=utf8mb4_unicode_ci;


-- ============================================================
-- ASSESSMENTS
-- ============================================================

CREATE TABLE IF NOT EXISTS `assessments` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `topic_id` BIGINT UNSIGNED NOT NULL,
    `title` VARCHAR(255) NOT NULL,
    `description` TEXT NULL,
    `total_questions` INT UNSIGNED NOT NULL DEFAULT 0,
    `total_points` INT UNSIGNED NOT NULL DEFAULT 0,
    `created_at` TIMESTAMP NULL DEFAULT NULL,
    `updated_at` TIMESTAMP NULL DEFAULT NULL,

    PRIMARY KEY (`id`),

    KEY `assessments_topic_id_foreign` (`topic_id`),

    CONSTRAINT `assessments_topic_id_foreign`
        FOREIGN KEY (`topic_id`)
        REFERENCES `topics` (`id`)
        ON DELETE CASCADE
        ON UPDATE CASCADE
) ENGINE=InnoDB
DEFAULT CHARSET=utf8mb4
COLLATE=utf8mb4_unicode_ci;


-- ============================================================
-- QUESTION ATTEMPTS
-- ============================================================

CREATE TABLE IF NOT EXISTS `question_attempts` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `user_id` BIGINT UNSIGNED NOT NULL,
    `question_id` BIGINT UNSIGNED NOT NULL,
    `selected_answer` ENUM('A','B','C','D') NOT NULL,
    `is_correct` TINYINT(1) NOT NULL DEFAULT 0,
    `score_earned` INT UNSIGNED NOT NULL DEFAULT 0,
    `created_at` TIMESTAMP NULL DEFAULT NULL,
    `updated_at` TIMESTAMP NULL DEFAULT NULL,

    PRIMARY KEY (`id`),

    KEY `attempts_user_id_foreign` (`user_id`),
    KEY `attempts_question_id_foreign` (`question_id`),

    CONSTRAINT `attempts_user_id_foreign`
        FOREIGN KEY (`user_id`)
        REFERENCES `users` (`id`)
        ON DELETE CASCADE
        ON UPDATE CASCADE,

    CONSTRAINT `attempts_question_id_foreign`
        FOREIGN KEY (`question_id`)
        REFERENCES `questions` (`id`)
        ON DELETE CASCADE
        ON UPDATE CASCADE
) ENGINE=InnoDB
DEFAULT CHARSET=utf8mb4
COLLATE=utf8mb4_unicode_ci;


-- ============================================================
-- USER ASSESSMENT PROGRESS
-- ============================================================

CREATE TABLE IF NOT EXISTS `user_assessment_progress` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `user_id` BIGINT UNSIGNED NOT NULL,
    `assessment_id` BIGINT UNSIGNED NOT NULL,

    `status` ENUM(
        'locked',
        'unlocked',
        'in_progress',
        'passed',
        'failed'
    ) NOT NULL DEFAULT 'locked',

    `score` DECIMAL(5,2) NULL,
    `correct` INT UNSIGNED NOT NULL DEFAULT 0,
    `total` INT UNSIGNED NOT NULL DEFAULT 0,
    `points_earned` INT UNSIGNED NOT NULL DEFAULT 0,

    `started_at` TIMESTAMP NULL DEFAULT NULL,
    `completed_at` TIMESTAMP NULL DEFAULT NULL,
    `created_at` TIMESTAMP NULL DEFAULT NULL,
    `updated_at` TIMESTAMP NULL DEFAULT NULL,

    PRIMARY KEY (`id`),

    UNIQUE KEY `unique_user_assessment`
        (`user_id`, `assessment_id`),

    CONSTRAINT `user_assessment_progress_user_id_foreign`
        FOREIGN KEY (`user_id`)
        REFERENCES `users` (`id`)
        ON DELETE CASCADE,

    CONSTRAINT `user_assessment_progress_assessment_id_foreign`
        FOREIGN KEY (`assessment_id`)
        REFERENCES `assessments` (`id`)
        ON DELETE CASCADE
) ENGINE=InnoDB
DEFAULT CHARSET=utf8mb4
COLLATE=utf8mb4_unicode_ci;


-- ============================================================
-- USER QUESTION PROGRESS
-- ============================================================

CREATE TABLE IF NOT EXISTS `user_question_progress` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `user_id` BIGINT UNSIGNED NOT NULL,
    `question_id` BIGINT UNSIGNED NOT NULL,

    `type` ENUM('practice','flashcard') NOT NULL,

    `selected_answer` VARCHAR(1) NULL,
    `is_correct` TINYINT(1) NOT NULL DEFAULT 0,
    `points_earned` INT UNSIGNED NOT NULL DEFAULT 0,

    `answered_at` TIMESTAMP NULL DEFAULT NULL,
    `created_at` TIMESTAMP NULL DEFAULT NULL,
    `updated_at` TIMESTAMP NULL DEFAULT NULL,

    PRIMARY KEY (`id`),

    UNIQUE KEY `unique_user_question_type`
        (`user_id`, `question_id`, `type`),

    CONSTRAINT `user_question_progress_user_id_foreign`
        FOREIGN KEY (`user_id`)
        REFERENCES `users` (`id`)
        ON DELETE CASCADE,

    CONSTRAINT `user_question_progress_question_id_foreign`
        FOREIGN KEY (`question_id`)
        REFERENCES `questions` (`id`)
        ON DELETE CASCADE
) ENGINE=InnoDB
DEFAULT CHARSET=utf8mb4
COLLATE=utf8mb4_unicode_ci;


SET FOREIGN_KEY_CHECKS = 1;