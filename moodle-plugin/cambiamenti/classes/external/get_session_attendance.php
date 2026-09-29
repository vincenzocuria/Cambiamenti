<?php
namespace local_cambiamenti\external;

defined('MOODLE_INTERNAL') || die();

use core_external\external_api;
use core_external\external_function_parameters;
use core_external\external_multiple_structure;
use core_external\external_single_structure;
use core_external\external_value;
use local_cambiamenti\attendance;

class get_session_attendance extends external_api {
    public static function execute_parameters(): external_function_parameters {
        return new external_function_parameters([
            'bbbinstanceid' => new external_value(PARAM_INT, 'BigBlueButton instance id'),
            'starts' => new external_value(PARAM_INT, 'Lesson start unix time'),
            'ends' => new external_value(PARAM_INT, 'Lesson end unix time'),
        ]);
    }

    public static function execute(int $bbbinstanceid, int $starts, int $ends): array {
        global $DB;

        $params = self::validate_parameters(self::execute_parameters(), [
            'bbbinstanceid' => $bbbinstanceid,
            'starts' => $starts,
            'ends' => $ends,
        ]);
        $instance = $DB->get_record('bigbluebuttonbn', ['id' => $params['bbbinstanceid']], '*', MUST_EXIST);
        $context = \context_course::instance($instance->course);
        self::validate_context($context);
        require_capability('moodle/course:update', $context);

        return attendance::for_instance(
            (int) $params['bbbinstanceid'],
            (int) $params['starts'],
            (int) $params['ends']
        );
    }

    public static function execute_returns(): external_multiple_structure {
        return new external_multiple_structure(
            new external_single_structure([
                'username' => new external_value(PARAM_TEXT, 'Moodle username'),
                'joined' => new external_value(PARAM_INT, 'First join unix time'),
                'left' => new external_value(PARAM_INT, 'Last leave unix time'),
                'minutes' => new external_value(PARAM_FLOAT, 'Minutes inside the window'),
            ])
        );
    }
}
