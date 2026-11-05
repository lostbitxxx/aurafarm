extends Node2D

const DesktopWalk = preload("res://scripts/desktop_walk.gd")
const WINDOW_SIZE := Vector2i(220, 260)
const PetLinkScript = preload("res://scripts/pet_link.gd")
const SPEED := Vector2i(80, 36)

var origin := Vector2i.ZERO
var velocity := SPEED


func _ready() -> void:
	if _skip_window():
		return
	_configure_window()
	var rects := _usable_rects()
	origin = _starting_origin(rects)
	DisplayServer.window_set_position(origin)
	DisplayServer.window_set_mouse_passthrough(_click_shape())
	add_child(PetLinkScript.new())


func _process(delta: float) -> void:
	if _skip_window():
		return
	var step := Vector2i(
		int(round(velocity.x * delta)),
		int(round(velocity.y * delta))
	)
	if step == Vector2i.ZERO:
		step = Vector2i(signi(velocity.x), signi(velocity.y))
	var result: Dictionary = DesktopWalk.step(origin, step, WINDOW_SIZE, _usable_rects())
	var next_velocity: Vector2i = result["velocity"]
	if signi(next_velocity.x) != signi(step.x):
		velocity.x = -velocity.x
	if signi(next_velocity.y) != signi(step.y):
		velocity.y = -velocity.y
	origin = result["position"]
	DisplayServer.window_set_position(origin)


func _skip_window() -> bool:
	return DisplayServer.get_name() == "headless" or OS.has_feature("web")


func _configure_window() -> void:
	var window := get_window()
	window.borderless = true
	window.transparent = true
	window.always_on_top = true
	window.unresizable = true
	DisplayServer.window_set_flag(DisplayServer.WINDOW_FLAG_BORDERLESS, true)
	DisplayServer.window_set_flag(DisplayServer.WINDOW_FLAG_ALWAYS_ON_TOP, true)
	DisplayServer.window_set_flag(DisplayServer.WINDOW_FLAG_TRANSPARENT, true)
	DisplayServer.window_set_size(WINDOW_SIZE)
	get_viewport().transparent_bg = true


func _click_shape() -> PackedVector2Array:
	return PackedVector2Array([
		Vector2(8, 20),
		Vector2(WINDOW_SIZE.x - 8, 20),
		Vector2(WINDOW_SIZE.x - 8, WINDOW_SIZE.y - 12),
		Vector2(8, WINDOW_SIZE.y - 12),
	])


func _usable_rects() -> Array:
	var rects: Array = []
	for index in DisplayServer.get_screen_count():
		rects.append(DisplayServer.screen_get_usable_rect(index))
	if rects.is_empty():
		rects.append(Rect2i(0, 0, 1920, 1080))
	return rects


func _starting_origin(rects: Array) -> Vector2i:
	var area: Rect2i = rects[0]
	return Vector2i(
		area.position.x + maxi(0, (area.size.x - WINDOW_SIZE.x) / 2),
		area.position.y + maxi(0, (area.size.y - WINDOW_SIZE.y) / 2)
	)
