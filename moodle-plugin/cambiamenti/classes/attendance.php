<?php
namespace local_cambiamenti;

defined('MOODLE_INTERNAL') || die();

/**
 * Accoppia ingressi e uscite di una stanza BigBlueButton dentro una finestra oraria.
 */
class attendance {
    /**
     * @return array<int, array{username: string, joined: int, left: int, minutes: float}>
     */
    public static function for_instance(int $instanceid, int $starts, int $ends): array {
        global $DB;

        $gracebefore = 15 * 60;
        $graceafter = 6 * 60 * 60;
        $logs = $DB->get_records_select(
            'bigbluebuttonbn_logs',
            'bigbluebuttonbnid = :id AND timecreated >= :from AND timecreated <= :to AND log IN (:joinlog, :logoutlog)',
            [
                'id' => $instanceid,
                'from' => $starts - $gracebefore,
                'to' => $ends + $graceafter,
                'joinlog' => 'Join',
                'logoutlog' => 'Logout',
            ],
            'userid ASC, timecreated ASC',
            'id, userid, timecreated, log'
        );

        $byuser = [];
        foreach ($logs as $log) {
            $byuser[$log->userid][] = $log;
        }

        $rows = [];
        foreach ($byuser as $userid => $events) {
            $spans = self::spans($events, $starts, $ends);
            if (!$spans) {
                continue;
            }
            $joined = $spans[0][0];
            $left = $spans[count($spans) - 1][1];
            $seconds = 0;
            foreach ($spans as $span) {
                $seconds += max(0, $span[1] - $span[0]);
            }
            $user = $DB->get_record('user', ['id' => $userid], 'id, username', IGNORE_MISSING);
            if (!$user || $user->username === 'guest') {
                continue;
            }
            $rows[] = [
                'username' => $user->username,
                'joined' => $joined,
                'left' => $left,
                'minutes' => round($seconds / 60, 1),
            ];
        }

        return $rows;
    }

    /**
     * @param array<int, \stdClass> $events
     * @return array<int, array{0: int, 1: int}>
     */
    private static function spans(array $events, int $starts, int $ends): array {
        $windowstart = $starts - 15 * 60;
        $windowend = $ends + 15 * 60;
        $open = null;
        $spans = [];
        foreach ($events as $event) {
            $at = (int) $event->timecreated;
            if ($event->log === 'Join') {
                if ($open !== null) {
                    $spans[] = [$open, $at];
                }
                $open = $at;
                continue;
            }
            if ($open !== null && $at >= $open) {
                $spans[] = [$open, $at];
                $open = null;
            }
        }
        if ($open !== null) {
            $spans[] = [$open, $ends];
        }

        $clipped = [];
        foreach ($spans as $span) {
            $from = max($span[0], $windowstart);
            $to = min($span[1], $windowend);
            if ($to > $from && $span[0] <= $windowend && $span[1] >= $windowstart) {
                $clipped[] = [$from, $to];
            }
        }
        return $clipped;
    }
}
