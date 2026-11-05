extends Node

## Dev export talks to the local desk. Change this before a production export.
const API_ORIGIN := "http://localhost:3000"
const TOKEN_PATH := "user://device_token.txt"
const SESSION_PATH := "user://study_session.json"

var _heartbeat: HTTPRequest
var _claim: HTTPRequest
var _token := ""
var _status: Label
var _code: LineEdit


func _ready() -> void:
	if DisplayServer.get_name() == "headless" or OS.has_feature("web"):
		return
	_build_form()
	_heartbeat = HTTPRequest.new()
	_claim = HTTPRequest.new()
	add_child(_heartbeat)
	add_child(_claim)
	_heartbeat.request_completed.connect(_on_heartbeat_done)
	_claim.request_completed.connect(_on_claim_done)
	_token = _read_token()
	_apply_launch_arguments()
	if _token != "":
		_set_status("Paired")
		_send_heartbeat()
	var timer := Timer.new()
	timer.wait_time = 10.0
	timer.autostart = true
	timer.timeout.connect(_send_heartbeat)
	add_child(timer)


func _build_form() -> void:
	_code = LineEdit.new()
	_code.position = Vector2(12, 168)
	_code.size = Vector2(196, 36)
	_code.placeholder_text = "Launch code"
	_code.text_submitted.connect(_on_code_entered)
	var style := StyleBoxFlat.new()
	style.bg_color = Color(0.968627, 0.952941, 0.909804, 0.95)
	style.set_corner_radius_all(8)
	_code.add_theme_stylebox_override("normal", style)
	_code.add_theme_color_override("font_color", Color(0.08, 0.13, 0.1))
	add_child(_code)

	_status = Label.new()
	_status.position = Vector2(12, 214)
	_status.size = Vector2(196, 32)
	_status.text = "Paste a launch code"
	_status.add_theme_color_override("font_color", Color(0.968627, 0.952941, 0.909804))
	add_child(_status)


func _apply_launch_arguments() -> void:
	var args := OS.get_cmdline_user_args()
	if args.is_empty():
		args = OS.get_cmdline_args()
	for argument in args:
		var text := str(argument)
		if text.begins_with("aurafarm://"):
			_open_url(text)


func _on_code_entered(text: String) -> void:
	var trimmed := text.strip_edges()
	if trimmed.begins_with("aurafarm://"):
		_open_url(trimmed)
		return
	_claim_code(trimmed)


func _open_url(url: String) -> void:
	var body := url.trim_prefix("aurafarm://")
	var parts := body.split("?", true, 1)
	var action := parts[0]
	var query := parts[1] if parts.size() == 2 else ""
	var parsed := _parse_query(query)
	if action == "pair" and parsed.has("token") and str(parsed["token"]) != "":
		_save_token(str(parsed["token"]))
		_set_status("Paired")
		_send_heartbeat()
	elif action == "session" and parsed.has("code"):
		_claim_code(str(parsed["code"]))


func _claim_code(code: String) -> void:
	var trimmed := code.strip_edges()
	if trimmed == "":
		return
	var headers := PackedStringArray(["Content-Type: application/json"])
	var err := _claim.request(
		API_ORIGIN + "/api/sessions/claim",
		headers,
		HTTPClient.METHOD_POST,
		JSON.stringify({"code": trimmed})
	)
	if err != OK:
		_set_status("Claim failed")


func _send_heartbeat() -> void:
	if _token == "":
		return
	var headers := PackedStringArray([
		"Authorization: Bearer " + _token,
		"Content-Type: application/json",
	])
	var err := _heartbeat.request(
		API_ORIGIN + "/api/pet/heartbeat",
		headers,
		HTTPClient.METHOD_POST,
		"{}"
	)
	if err != OK and err != ERR_BUSY:
		_set_status("Heartbeat failed")


func _on_heartbeat_done(result: int, response_code: int, _headers: PackedStringArray, _body: PackedByteArray) -> void:
	if result != HTTPRequest.RESULT_SUCCESS or response_code != 200:
		_set_status("Heartbeat rejected")
		return
	_set_status("Pet is running")


func _on_claim_done(result: int, response_code: int, _headers: PackedStringArray, body: PackedByteArray) -> void:
	if result != HTTPRequest.RESULT_SUCCESS or response_code != 200:
		_set_status("Claim rejected")
		return
	var parsed: Variant = JSON.parse_string(body.get_string_from_utf8())
	if typeof(parsed) != TYPE_DICTIONARY:
		_set_status("Claim rejected")
		return
	var record: Dictionary = parsed
	if not record.has("token"):
		_set_status("Claim rejected")
		return
	var file := FileAccess.open(SESSION_PATH, FileAccess.WRITE)
	if file == null:
		_set_status("Claim rejected")
		return
	file.store_string(JSON.stringify(parsed))
	file.close()
	_set_status("Session ready")
	_code.text = ""


func _save_token(token: String) -> void:
	_token = token.strip_edges()
	var file := FileAccess.open(TOKEN_PATH, FileAccess.WRITE)
	if file == null:
		return
	file.store_string(_token)
	file.close()


func _read_token() -> String:
	if not FileAccess.file_exists(TOKEN_PATH):
		return ""
	var file := FileAccess.open(TOKEN_PATH, FileAccess.READ)
	if file == null:
		return ""
	var token := file.get_as_text().strip_edges()
	file.close()
	return token


func _parse_query(query: String) -> Dictionary:
	var result := {}
	if query.is_empty():
		return result
	for part in query.split("&", false):
		var bits := part.split("=", true, 1)
		if bits.size() == 2:
			result[_decode(bits[0])] = _decode(bits[1])
	return result


func _decode(value: String) -> String:
	return value.replace("+", " ").uri_decode()


func _set_status(text: String) -> void:
	if _status:
		_status.text = text
