<?php
defined('MOODLE_INTERNAL') || die();

$functions = [
    'local_cambiamenti_create_fad_course' => [
        'classname' => \local_cambiamenti\external\create_fad_course::class,
        'methodname' => 'execute',
        'description' => 'Create or update a course with a single BigBlueButton room.',
        'type' => 'write',
        'ajax' => false,
        'capabilities' => 'moodle/course:create',
    ],
    'local_cambiamenti_get_session_attendance' => [
        'classname' => \local_cambiamenti\external\get_session_attendance::class,
        'methodname' => 'execute',
        'description' => 'Attendance minutes for one BigBlueButton room in a time window.',
        'type' => 'read',
        'ajax' => false,
        'capabilities' => 'moodle/course:update',
    ],
];
