<?php
/**
 * SuperYT — yerel YouTube servisi
 *
 * - Video araması
 * - Oynatma listesi içe aktarma
 * - YouTube kanalındaki hazır playlistleri çekme
 *
 * Kullanım:
 *   api/youtube.php?action=search&q=tarkan&type=video&page=1&region=TR
 *   api/youtube.php?action=playlist&id=PL...
 *   api/youtube.php?action=channel_playlists&id=UC-9-kyTW8ZkZNDHQJ6FgpwQ
 */

declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, max-age=0');
header('X-Content-Type-Options: nosniff');

@set_time_limit(30);

const YT_CLIENT_NAME = 'WEB';
const YT_CLIENT_VERSION = '2.20240726.00.00';
const YT_SEARCH_TTL = 600;
const YT_PLAYLIST_TTL = 600;
const YT_CHANNEL_TTL = 900;
const YT_MAX_PLAYLIST_VIDEOS = 500;
const YT_PLAYLIST_MAX_PAGES = 6;

function respond(array $data, int $status = 200): void
{
    http_response_code($status);
    echo json_encode(
        $data,
        JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_INVALID_UTF8_SUBSTITUTE
    );
    exit;
}

function fail(string $message, int $status = 400): void
{
    respond(['error' => $message], $status);
}

function cache_dir(): string
{
    static $dir = null;
    if ($dir !== null) return $dir;

    $candidates = [
        rtrim(sys_get_temp_dir(), DIRECTORY_SEPARATOR) . DIRECTORY_SEPARATOR . 'superyt-youtube-cache',
        __DIR__ . DIRECTORY_SEPARATOR . 'cache',
    ];

    foreach ($candidates as $candidate) {
        if (!is_dir($candidate)) @mkdir($candidate, 0775, true);
        if (is_dir($candidate) && is_writable($candidate)) {
            if ($candidate === __DIR__ . DIRECTORY_SEPARATOR . 'cache') {
                $htaccess = $candidate . DIRECTORY_SEPARATOR . '.htaccess';
                if (!is_file($htaccess)) {
                    @file_put_contents($htaccess, "Require all denied\nDeny from all\nOptions -Indexes\n");
                }
            }
            $dir = $candidate;
            return $dir;
        }
    }

    $dir = rtrim(sys_get_temp_dir(), DIRECTORY_SEPARATOR);
    return $dir;
}

function cache_file(string $key): string
{
    return cache_dir() . DIRECTORY_SEPARATOR . hash('sha256', $key) . '.json';
}

/** @return array{0: resource, 1: array} */
function cache_open(string $key): array
{
    $fp = @fopen(cache_file($key), 'c+');
    if (!$fp) fail('Arama önbelleği açılamadı. Sunucuda yazma izni yok.', 500);
    if (!flock($fp, LOCK_EX)) {
        fclose($fp);
        fail('Arama önbelleği kilitlenemedi.', 500);
    }
    rewind($fp);
    $raw = stream_get_contents($fp);
    $data = is_string($raw) && $raw !== '' ? json_decode($raw, true) : null;
    if (!is_array($data)) $data = [];
    return [$fp, $data];
}

function cache_save($fp, array $data): void
{
    rewind($fp);
    ftruncate($fp, 0);
    fwrite($fp, json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
    fflush($fp);
    flock($fp, LOCK_UN);
    fclose($fp);
}

function cache_close($fp): void
{
    @flock($fp, LOCK_UN);
    @fclose($fp);
}

function yt_request(string $endpoint, array $payload): ?array
{
    $url = 'https://www.youtube.com/youtubei/v1/' . $endpoint . '?prettyPrint=false';
    $payload['context'] = [
        'client' => [
            'clientName' => YT_CLIENT_NAME,
            'clientVersion' => YT_CLIENT_VERSION,
            'hl' => 'tr',
            'gl' => 'TR',
        ],
    ];

    $body = json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if ($body === false) return null;

    for ($attempt = 1; $attempt <= 2; $attempt++) {
        $ch = curl_init($url);
        if ($ch === false) return null;

        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => $body,
            CURLOPT_HTTPHEADER => [
                'Content-Type: application/json',
                'Accept: application/json',
                'Accept-Language: tr-TR,tr;q=0.9,en;q=0.8',
                'Origin: https://www.youtube.com',
                'Referer: https://www.youtube.com/',
                'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
                'X-YouTube-Client-Name: 1',
                'X-YouTube-Client-Version: ' . YT_CLIENT_VERSION,
            ],
            CURLOPT_ENCODING => '',
            CURLOPT_CONNECTTIMEOUT => 6,
            CURLOPT_TIMEOUT => 14,
            CURLOPT_FOLLOWLOCATION => false,
            CURLOPT_SSL_VERIFYPEER => true,
        ]);

        $raw = curl_exec($ch);
        $code = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $err = curl_error($ch);
        curl_close($ch);

        if (is_string($raw) && $raw !== '' && $code >= 200 && $code < 300) {
            $json = json_decode($raw, true);
            return is_array($json) ? $json : null;
        }

        if ($attempt < 2 && ($code === 429 || $code >= 500)) {
            usleep(300000);
            continue;
        }

        if ($err !== '') error_log('[SuperYT YouTube API] ' . $err);
        return null;
    }

    return null;
}

function text_value($value): string
{
    if (is_string($value)) return $value;
    if (!is_array($value)) return '';

    if (isset($value['simpleText']) && is_string($value['simpleText'])) {
        return $value['simpleText'];
    }
    if (isset($value['content']) && is_string($value['content'])) {
        return $value['content'];
    }
    if (isset($value['runs']) && is_array($value['runs'])) {
        $parts = [];
        foreach ($value['runs'] as $run) {
            if (is_array($run) && isset($run['text']) && is_string($run['text'])) {
                $parts[] = $run['text'];
            }
        }
        return implode('', $parts);
    }
    return '';
}

function parse_duration(string $text): int
{
    $text = trim($text);
    if ($text === '' || stripos($text, 'canlı') !== false || stripos($text, 'live') !== false) {
        return 0;
    }
    if (!preg_match('/^(\d{1,2}:)?\d{1,2}:\d{2}$/', $text)) return 0;
    $parts = array_map('intval', explode(':', $text));
    if (count($parts) === 3) return $parts[0] * 3600 + $parts[1] * 60 + $parts[2];
    if (count($parts) === 2) return $parts[0] * 60 + $parts[1];
    return 0;
}

function parse_views(string $text): int
{
    $text = str_replace(["\xc2\xa0", ' '], ' ', trim($text));
    if ($text === '') return 0;

    if (preg_match('/([\d.,]+)\s*(mn|milyon|b|bn|milyar|bin|k)\b/iu', $text, $m)) {
        $num = (float)str_replace(',', '.', $m[1]);
        $unit = strtolower($m[2]);
        if (in_array($unit, ['mn', 'milyon'], true)) return (int)round($num * 1000000);
        if (in_array($unit, ['b', 'bn', 'milyar'], true)) return (int)round($num * 1000000000);
        if (in_array($unit, ['bin', 'k'], true)) return (int)round($num * 1000);
    }

    if (preg_match('/([\d.,]+)/u', $text, $m)) {
        $digits = preg_replace('/\D+/', '', $m[1]);
        return $digits !== '' ? (int)$digits : 0;
    }
    return 0;
}

function parse_video_count(string $text): int
{
    if ($text === '') return 0;
    if (preg_match('/([\d.,]+)\s*(bin|k|mn|milyon|b|bn|milyar)?\s*(video|şarkı|sarki)?/iu', $text, $m)) {
        $num = (float)str_replace(',', '.', $m[1]);
        $unit = strtolower($m[2] ?? '');
        if (in_array($unit, ['bin', 'k'], true)) return (int)round($num * 1000);
        if (in_array($unit, ['mn', 'milyon'], true)) return (int)round($num * 1000000);
        if (in_array($unit, ['b', 'bn', 'milyar'], true)) return (int)round($num * 1000000000);
        return (int)round($num);
    }
    return 0;
}

function find_badge_texts($node): array
{
    $out = [];
    $walk = function ($value) use (&$walk, &$out): void {
        if (!is_array($value)) return;
        if (isset($value['thumbnailBadgeViewModel']['text'])) {
            $txt = text_value($value['thumbnailBadgeViewModel']['text']);
            if ($txt !== '') $out[] = $txt;
        }
        foreach ($value as $child) $walk($child);
    };
    $walk($node);
    return $out;
}

function lockup_author(array $lockup): string
{
    $meta = $lockup['metadata']['lockupMetadataViewModel'] ?? [];
    $rows = $meta['metadata']['contentMetadataViewModel']['metadataRows'] ?? [];
    if (is_array($rows)) {
        foreach ($rows as $row) {
            $parts = $row['metadataParts'] ?? [];
            if (!is_array($parts)) continue;
            foreach ($parts as $part) {
                $txt = trim(text_value($part['text'] ?? []));
                if ($txt === '') continue;
                if (preg_match('/^(oynatma listesi|playlist|video|albüm|album)$/iu', $txt)) continue;
                if (preg_match('/görüntüleme|views|önce|ago|güncellendi|updated/iu', $txt)) continue;
                return $txt;
            }
        }
    }
    return '';
}

function parse_lockup(array $lockup, string $expected): ?array
{
    $contentType = (string)($lockup['contentType'] ?? '');
    $id = (string)($lockup['contentId'] ?? '');
    if ($id === '') return null;

    $meta = $lockup['metadata']['lockupMetadataViewModel'] ?? [];
    $title = trim(text_value($meta['title'] ?? []));
    if ($title === '') return null;

    $playlistTypes = [
        'LOCKUP_CONTENT_TYPE_PLAYLIST',
        'LOCKUP_CONTENT_TYPE_STATION',
        'LOCKUP_CONTENT_TYPE_ALBUM',
    ];

    if ($expected === 'playlist' || $expected === 'channel_playlist') {
        if (!in_array($contentType, $playlistTypes, true)) return null;

        $count = 0;
        foreach (find_badge_texts($lockup) as $badge) {
            if (preg_match('/video|şarkı|sarki/iu', $badge)) {
                $count = parse_video_count($badge);
                if ($count > 0) break;
            }
        }

        return [
            'type' => 'playlist',
            'playlistId' => $id,
            'title' => $title,
            'author' => lockup_author($lockup),
            'videoCount' => $count,
        ];
    }

    if ($contentType !== 'LOCKUP_CONTENT_TYPE_VIDEO') return null;

    $length = 0;
    foreach (find_badge_texts($lockup) as $badge) {
        if (preg_match('/^\d{1,2}:\d{2}(?::\d{2})?$/', trim($badge))) {
            $length = parse_duration(trim($badge));
            break;
        }
    }

    $views = 0;
    $rows = $meta['metadata']['contentMetadataViewModel']['metadataRows'] ?? [];
    if (is_array($rows)) {
        foreach ($rows as $row) {
            foreach (($row['metadataParts'] ?? []) as $part) {
                $txt = text_value($part['text'] ?? []);
                if (preg_match('/görüntüleme|views/iu', $txt)) {
                    $views = parse_views($txt);
                    break 2;
                }
            }
        }
    }

    return [
        'type' => 'video',
        'videoId' => $id,
        'title' => $title,
        'author' => lockup_author($lockup),
        'lengthSeconds' => $length,
        'viewCount' => $views,
    ];
}

function parse_video_renderer(array $r): ?array
{
    $id = (string)($r['videoId'] ?? '');
    if ($id === '') return null;
    $title = trim(text_value($r['title'] ?? []));
    if ($title === '') return null;
    $author = text_value($r['ownerText'] ?? ($r['longBylineText'] ?? $r['shortBylineText'] ?? []));
    return [
        'type' => 'video',
        'videoId' => $id,
        'title' => $title,
        'author' => trim($author),
        'lengthSeconds' => parse_duration(text_value($r['lengthText'] ?? [])),
        'viewCount' => parse_views(text_value($r['viewCountText'] ?? [])),
    ];
}

function parse_playlist_renderer(array $r): ?array
{
    $id = (string)($r['playlistId'] ?? '');
    if ($id === '') return null;
    $title = trim(text_value($r['title'] ?? []));
    if ($title === '') return null;
    $author = text_value($r['shortBylineText'] ?? ($r['longBylineText'] ?? []));
    return [
        'type' => 'playlist',
        'playlistId' => $id,
        'title' => $title,
        'author' => trim($author),
        'videoCount' => parse_video_count(text_value($r['videoCountText'] ?? ($r['videoCountShortText'] ?? []))),
    ];
}

function parse_playlist_video_renderer(array $r): ?array
{
    $id = (string)($r['videoId'] ?? '');
    if ($id === '') return null;
    $title = trim(text_value($r['title'] ?? []));
    if ($title === '') return null;
    $author = text_value($r['shortBylineText'] ?? ($r['longBylineText'] ?? []));
    return [
        'type' => 'video',
        'videoId' => $id,
        'title' => $title,
        'author' => trim($author),
        'lengthSeconds' => parse_duration(text_value($r['lengthText'] ?? [])),
        'viewCount' => 0,
    ];
}

function collect_search_items(array $response, string $type): array
{
    $items = [];
    $seen = [];

    $add = function (?array $item, string $idKey) use (&$items, &$seen): void {
        if (!$item) return;
        $id = (string)($item[$idKey] ?? '');
        if ($id === '' || isset($seen[$id])) return;
        $seen[$id] = true;
        $items[] = $item;
    };

    $walk = function ($node) use (&$walk, &$add, $type): void {
        if (!is_array($node)) return;
        foreach ($node as $key => $value) {
            if (!is_array($value)) continue;
            if ($key === 'videoRenderer' && $type === 'video') {
                $add(parse_video_renderer($value), 'videoId');
            } elseif ($key === 'playlistRenderer' && $type === 'playlist') {
                $add(parse_playlist_renderer($value), 'playlistId');
            } elseif ($key === 'lockupViewModel') {
                $add(parse_lockup($value, $type), $type === 'playlist' ? 'playlistId' : 'videoId');
            }
            $walk($value);
        }
    };
    $walk($response);

    return $items;
}

function find_continuation_token($node): ?string
{
    if (!is_array($node)) return null;
    if (isset($node['continuationCommand']['token']) && is_string($node['continuationCommand']['token'])) {
        return $node['continuationCommand']['token'];
    }
    foreach ($node as $value) {
        $token = find_continuation_token($value);
        if ($token) return $token;
    }
    return null;
}

function find_search_continuation(array $response): ?string
{
    $token = null;
    $walk = function ($node, $depth = 0) use (&$walk, &$token): void {
        if ($token !== null || $depth > 12 || !is_array($node)) return;
        if (isset($node['continuationItemRenderer'])) {
            $token = find_continuation_token($node['continuationItemRenderer']);
            if ($token) return;
        }
        foreach ($node as $value) $walk($value, $depth + 1);
    };
    $walk($response);
    return $token;
}

/** @return array{videos: array, token: ?string}|null */
function find_playlist_chunk(array $response): ?array
{
    $result = null;
    $walk = function ($node, $depth = 0) use (&$walk, &$result): void {
        if ($result !== null || $depth > 14 || !is_array($node)) return;

        $videos = [];
        $token = null;
        foreach ($node as $key => $value) {
            if (!is_array($value)) continue;

            $lockup = null;
            if ($key === 'lockupViewModel') {
                $lockup = $value;
            } elseif (isset($value['lockupViewModel']) && is_array($value['lockupViewModel'])) {
                $lockup = $value['lockupViewModel'];
            }

            if (is_array($lockup)) {
                if (($lockup['contentType'] ?? '') === 'LOCKUP_CONTENT_TYPE_VIDEO') $videos[] = $lockup;
            } elseif ($key === 'playlistVideoRenderer') {
                $videos[] = ['playlistVideoRenderer' => $value];
            } elseif (isset($value['playlistVideoRenderer']) && is_array($value['playlistVideoRenderer'])) {
                $videos[] = ['playlistVideoRenderer' => $value['playlistVideoRenderer']];
            } elseif ($key === 'continuationItemViewModel') {
                $t = find_continuation_token($value);
                if ($t) $token = $t;
            } elseif (isset($value['continuationItemViewModel']) && is_array($value['continuationItemViewModel'])) {
                $t = find_continuation_token($value['continuationItemViewModel']);
                if ($t) $token = $t;
            }
        }

        if ($videos) {
            $result = ['videos' => $videos, 'token' => $token];
            return;
        }

        foreach ($node as $value) $walk($value, $depth + 1);
    };
    $walk($response);
    return $result;
}

function search_params(string $type, string $sort): string
{
    if ($type === 'playlist') return 'EgIQAw%3D%3D';
    if ($sort === 'views') return 'CAMSAhAB';
    return 'EgA%3D';
}

function get_search_page(string $query, string $type, int $page, string $sort): array
{
    $page = max(1, min(20, $page));
    $cacheKey = 'search:' . $type . ':' . $sort . ':' . $query;
    [$fp, $cache] = cache_open($cacheKey);

    if (!isset($cache['updated']) || !is_int($cache['updated']) || time() - $cache['updated'] > YT_SEARCH_TTL) {
        $cache = ['updated' => time(), 'pages' => [], 'tokens' => []];
    }

    if (isset($cache['pages'][(string)$page]) && is_array($cache['pages'][(string)$page])) {
        $items = $cache['pages'][(string)$page];
        cache_close($fp);
        return $items;
    }

    $nextPage = 1;
    $token = null;

    for ($p = $page - 1; $p >= 1; $p--) {
        if (!empty($cache['tokens'][(string)$p])) {
            $nextPage = $p + 1;
            $token = (string)$cache['tokens'][(string)$p];
            break;
        }
    }

    if ($nextPage === 1) {
        $response = yt_request('search', [
            'query' => $query,
            'params' => search_params($type, $sort),
        ]);
        if ($response === null) {
            cache_close($fp);
            fail('YouTube arama servisine ulaşılamadı.', 502);
        }

        $items = collect_search_items($response, $type);
        $cache['pages']['1'] = $items;
        $next = find_search_continuation($response);
        if ($next) $cache['tokens']['1'] = $next;
        $cache['updated'] = time();

        if ($page === 1) {
            cache_save($fp, $cache);
            return $items;
        }

        $nextPage = 2;
        $token = $next;
    }

    while ($nextPage <= $page && $token) {
        $response = yt_request('search', ['continuation' => $token]);
        if ($response === null) {
            cache_save($fp, $cache);
            fail('YouTube arama sayfası alınamadı.', 502);
        }

        $items = collect_search_items($response, $type);
        $cache['pages'][(string)$nextPage] = $items;
        $next = find_search_continuation($response);
        if ($next) {
            $cache['tokens'][(string)$nextPage] = $next;
        } else {
            unset($cache['tokens'][(string)$nextPage]);
        }
        $cache['updated'] = time();

        if ($nextPage === $page) {
            cache_save($fp, $cache);
            return $items;
        }

        $token = $next;
        $nextPage++;
    }

    cache_save($fp, $cache);
    return [];
}

function get_playlist(string $playlistId): array
{
    $cacheKey = 'playlist:' . $playlistId;
    [$fp, $cache] = cache_open($cacheKey);

    if (
        isset($cache['updated'], $cache['videos']) &&
        is_int($cache['updated']) &&
        time() - $cache['updated'] <= YT_PLAYLIST_TTL &&
        is_array($cache['videos'])
    ) {
        cache_close($fp);
        return $cache;
    }

    $deadline = microtime(true) + 24;
    $response = yt_request('browse', ['browseId' => 'VL' . $playlistId]);
    if ($response === null) {
        cache_close($fp);
        fail('YouTube oynatma listesine ulaşılamadı.', 502);
    }

    $videos = [];
    $seen = [];

    for ($page = 0; $page < YT_PLAYLIST_MAX_PAGES; $page++) {
        $chunk = find_playlist_chunk($response);
        if (!$chunk || !$chunk['videos']) break;

        foreach ($chunk['videos'] as $raw) {
            $item = isset($raw['playlistVideoRenderer'])
                ? parse_playlist_video_renderer($raw['playlistVideoRenderer'])
                : parse_lockup($raw, 'video');
            if (!$item) continue;
            $id = (string)$item['videoId'];
            if ($id === '' || isset($seen[$id])) continue;
            $seen[$id] = true;
            $videos[] = [
                'videoId' => $id,
                'title' => $item['title'],
                'author' => $item['author'],
                'lengthSeconds' => $item['lengthSeconds'] ?? 0,
            ];
            if (count($videos) >= YT_MAX_PLAYLIST_VIDEOS) break 2;
        }

        $token = $chunk['token'];
        if (!$token || microtime(true) >= $deadline) break;

        $response = yt_request('browse', ['continuation' => $token]);
        if ($response === null) break;
    }

    $cache = [
        'updated' => time(),
        'playlistId' => $playlistId,
        'title' => '',
        'author' => '',
        'videoCount' => count($videos),
        'videos' => $videos,
    ];
    cache_save($fp, $cache);
    return $cache;
}

function get_channel_playlists(string $channelId): array
{
    $cacheKey = 'channel_playlists:' . $channelId;
    [$fp, $cache] = cache_open($cacheKey);

    if (
        isset($cache['updated'], $cache['playlists']) &&
        is_int($cache['updated']) &&
        time() - $cache['updated'] <= YT_CHANNEL_TTL &&
        is_array($cache['playlists'])
    ) {
        cache_close($fp);
        return $cache['playlists'];
    }

    $response = yt_request('browse', ['browseId' => $channelId]);
    if ($response === null) {
        cache_close($fp);
        fail('YouTube kanalına ulaşılamadı.', 502);
    }

    $playlists = [];
    $seen = [];
    $walk = function ($node) use (&$walk, &$playlists, &$seen): void {
        if (!is_array($node)) return;
        foreach ($node as $key => $value) {
            if (!is_array($value)) continue;
            if ($key === 'lockupViewModel') {
                $item = parse_lockup($value, 'channel_playlist');
                if ($item) {
                    $id = (string)$item['playlistId'];
                    if ($id !== '' && !isset($seen[$id])) {
                        $seen[$id] = true;
                        $playlists[] = $item;
                    }
                }
            }
            $walk($value);
        }
    };
    $walk($response);

    $cache = ['updated' => time(), 'playlists' => $playlists];
    cache_save($fp, $cache);
    return $playlists;
}

$action = isset($_GET['action']) ? (string)$_GET['action'] : '';

try {
    if ($action === 'search') {
        $query = isset($_GET['q']) ? trim((string)$_GET['q']) : '';
        if ($query === '') fail('Arama sorgusu boş.');
        if (strlen($query) > 200) fail('Arama sorgusu çok uzun.');

        $type = (isset($_GET['type']) && $_GET['type'] === 'playlist') ? 'playlist' : 'video';
        $page = isset($_GET['page']) ? (int)$_GET['page'] : 1;
        $sort = (isset($_GET['sort']) && $_GET['sort'] === 'views') ? 'views' : '';

        respond(get_search_page($query, $type, $page, $sort));
    }

    if ($action === 'playlist') {
        $playlistId = isset($_GET['id']) ? trim((string)$_GET['id']) : '';
        if (!preg_match('/^[A-Za-z0-9_-]{6,120}$/', $playlistId)) {
            fail('Geçersiz oynatma listesi kimliği.');
        }
        respond(get_playlist($playlistId));
    }

    if ($action === 'channel_playlists') {
        $channelId = isset($_GET['id']) ? trim((string)$_GET['id']) : '';
        if (!preg_match('/^UC[A-Za-z0-9_-]{10,120}$/', $channelId)) {
            fail('Geçersiz kanal kimliği.');
        }
        respond(get_channel_playlists($channelId));
    }

    fail('Bilinmeyen işlem. action=search, action=playlist veya action=channel_playlists kullanın.');
} catch (Throwable $e) {
    error_log('[SuperYT YouTube API] ' . $e->getMessage());
    respond(['error' => 'Sunucu hatası.'], 500);
}
