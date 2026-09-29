<?php
namespace local_cambiamenti\external;

defined('MOODLE_INTERNAL') || die();

use core_external\external_api;
use core_external\external_function_parameters;
use core_external\external_single_structure;
use core_external\external_value;

class create_fad_course extends external_api {
    public static function execute_parameters(): external_function_parameters {
        return new external_function_parameters([
            'fullname' => new external_value(PARAM_TEXT, 'Course name'),
            'shortname' => new external_value(PARAM_TEXT, 'Unique short name'),
            'summary' => new external_value(PARAM_RAW, 'Summary', VALUE_DEFAULT, ''),
            'startdate' => new external_value(PARAM_INT, 'Start unix time', VALUE_DEFAULT, 0),
            'enddate' => new external_value(PARAM_INT, 'End unix time', VALUE_DEFAULT, 0),
        ]);
    }

    public static function execute(
        string $fullname,
        string $shortname,
        string $summary = '',
        int $startdate = 0,
        int $enddate = 0
    ): array {
        global $DB;

        $params = self::validate_parameters(self::execute_parameters(), [
            'fullname' => $fullname,
            'shortname' => $shortname,
            'summary' => $summary,
            'startdate' => $startdate,
            'enddate' => $enddate,
        ]);
        $context = \context_system::instance();
        self::validate_context($context);
        require_capability('moodle/course:create', $context);
        self::load_course_libs();

        $shortname = trim($params['shortname']);
        if ($shortname === '') {
            throw new \invalid_parameter_exception('shortname');
        }

        $categoryid = self::category_id();
        $existing = $DB->get_record('course', ['shortname' => $shortname]);
        if ($existing) {
            $existing->fullname = $params['fullname'];
            $existing->summary = $params['summary'];
            $existing->summaryformat = FORMAT_HTML;
            if ($params['startdate'] > 0) {
                $existing->startdate = $params['startdate'];
            }
            if ($params['enddate'] > 0) {
                $existing->enddate = $params['enddate'];
            }
            update_course($existing);
            $course = get_course($existing->id);
            $created = false;
        } else {
            $course = create_course((object) [
                'fullname' => $params['fullname'],
                'shortname' => $shortname,
                'category' => $categoryid,
                'summary' => $params['summary'],
                'summaryformat' => FORMAT_HTML,
                'format' => 'topics',
                'numsections' => 1,
                'startdate' => $params['startdate'] > 0 ? $params['startdate'] : time(),
                'enddate' => $params['enddate'],
                'visible' => 1,
            ]);
            $created = true;
        }

        $bbb = self::ensure_room($course);

        return [
            'courseid' => (int) $course->id,
            'bbbinstanceid' => (int) $bbb,
            'created' => $created,
        ];
    }

    public static function execute_returns(): external_single_structure {
        return new external_single_structure([
            'courseid' => new external_value(PARAM_INT, 'Moodle course id'),
            'bbbinstanceid' => new external_value(PARAM_INT, 'BigBlueButton instance id'),
            'created' => new external_value(PARAM_BOOL, 'True when the course was created'),
        ]);
    }

    private static function load_course_libs(): void {
        global $CFG;
        require_once($CFG->dirroot . '/course/lib.php');
        require_once($CFG->dirroot . '/course/modlib.php');
    }

    private static function category_id(): int {
        global $DB;
        $named = $DB->get_record('course_categories', ['name' => 'CORSI PROGRAMMA GOL'], 'id', IGNORE_MULTIPLE);
        if ($named) {
            return (int) $named->id;
        }
        $any = $DB->get_records_select('course_categories', 'id > 0', null, 'id ASC', 'id', 0, 1);
        $first = reset($any);
        if (!$first) {
            throw new \moodle_exception('cannotcreatecourse', 'error');
        }
        return (int) $first->id;
    }

    private static function ensure_room(\stdClass $course): int {
        global $DB;

        $existing = $DB->get_record('bigbluebuttonbn', ['course' => $course->id], 'id', IGNORE_MULTIPLE);
        if ($existing) {
            return (int) $existing->id;
        }

        $moduleid = $DB->get_field('modules', 'id', ['name' => 'bigbluebuttonbn'], MUST_EXIST);
        $info = (object) [
            'modulename' => 'bigbluebuttonbn',
            'module' => $moduleid,
            'course' => $course->id,
            'section' => 0,
            'visible' => 1,
            'visibleoncoursepage' => 1,
            'name' => 'Aula virtuale',
            'intro' => '',
            'introformat' => FORMAT_HTML,
            'type' => 0,
            'openingtime' => 0,
            'closingtime' => 0,
            'record' => 0,
            'welcome' => '',
            'cmidnumber' => '',
            'groupmode' => 0,
            'groupingid' => 0,
            'completion' => 0,
            'completionview' => 0,
            'completionexpected' => 0,
            'availability' => null,
            'downloadcontent' => 1,
            'showdescription' => 0,
        ];
        $cm = add_moduleinfo($info, $course);
        return (int) $cm->instance;
    }
}
