extends SceneTree

const DesktopWalk = preload("res://scripts/desktop_walk.gd")

func _init() -> void:
	quit(_check())


func _check() -> int:
	var window := Vector2i(128, 128)
	var desk := Rect2i(0, 0, 1920, 1080)
	var edge := Vector2i(1920 - window.x, 100)
	var velocity := Vector2i(4, 0)

	var turned: Dictionary = DesktopWalk.step(edge, velocity, window, [desk])
	if int(turned["position"].x) >= edge.x or int(turned["velocity"].x) >= 0:
		push_error("A pet at the right edge of 1920x1080 should move left.")
		return 1

	var second := Rect2i(1920, 0, 1920, 1080)
	var crossed: Dictionary = DesktopWalk.step(edge, velocity, window, [desk, second])
	if int(crossed["position"].x) < 1920 or int(crossed["velocity"].x) <= 0:
		push_error("A pet at the right edge should step onto the rect at x=1920.")
		return 1

	var middle: Dictionary = DesktopWalk.step(Vector2i(100, 100), velocity, window, [desk])
	if middle["position"] != Vector2i(104, 100):
		push_error("A pet in open space should keep its direction.")
		return 1

	print("desktop walk ok")
	return 0
