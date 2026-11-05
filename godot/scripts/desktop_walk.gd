extends RefCounted

## Moves a sprite-sized window across usable desktop rects.
## The origin is the window's top-left. A step that still fits keeps going.
## A step off the edge crosses onto a touching rect, or turns around.

static func step(origin: Vector2i, velocity: Vector2i, window_size: Vector2i, rects: Array) -> Dictionary:
	var candidate := origin + velocity
	if _fits(candidate, window_size, rects):
		return {"position": candidate, "velocity": velocity}

	var jumped: Variant = _jump(origin, velocity, window_size, rects)
	if jumped != null:
		return {"position": jumped, "velocity": velocity}

	var turned := velocity
	if not _fits(Vector2i(origin.x + velocity.x, origin.y), window_size, rects):
		turned.x = -velocity.x
	if not _fits(Vector2i(origin.x, origin.y + velocity.y), window_size, rects):
		turned.y = -velocity.y
	var bounced := origin + turned
	if not _fits(bounced, window_size, rects):
		bounced = origin
	return {"position": bounced, "velocity": turned}


static func _fits(origin: Vector2i, window_size: Vector2i, rects: Array) -> bool:
	if window_size.x <= 0 or window_size.y <= 0:
		return false
	var window := Rect2i(origin, window_size)
	for item in rects:
		var area := item as Rect2i
		if area.encloses(window):
			return true
	return false


static func _jump(origin: Vector2i, velocity: Vector2i, window_size: Vector2i, rects: Array) -> Variant:
	var current: Variant = _enclosing(origin, window_size, rects)
	if current == null:
		return null
	var area: Rect2i = current
	if not _against_edge(origin, window_size, area, velocity):
		return null
	for item in rects:
		var other := item as Rect2i
		if other == area or not _touches(area, other, velocity):
			continue
		var landed := _land(origin, window_size, other, velocity)
		if _fits(landed, window_size, [other]):
			return landed
	return null


static func _enclosing(origin: Vector2i, window_size: Vector2i, rects: Array) -> Variant:
	var window := Rect2i(origin, window_size)
	for item in rects:
		var area := item as Rect2i
		if area.encloses(window):
			return area
	return null


static func _against_edge(origin: Vector2i, window_size: Vector2i, area: Rect2i, velocity: Vector2i) -> bool:
	var window := Rect2i(origin, window_size)
	if velocity.x > 0 and window.end.x > area.end.x - velocity.x and window.end.x <= area.end.x:
		return true
	if velocity.x < 0 and window.position.x < area.position.x - velocity.x and window.position.x >= area.position.x:
		return true
	if velocity.y > 0 and window.end.y > area.end.y - velocity.y and window.end.y <= area.end.y:
		return true
	if velocity.y < 0 and window.position.y < area.position.y - velocity.y and window.position.y >= area.position.y:
		return true
	return false


static func _touches(current: Rect2i, other: Rect2i, velocity: Vector2i) -> bool:
	if velocity.x > 0 and other.position.x == current.end.x:
		return _overlap(current.position.y, current.end.y, other.position.y, other.end.y)
	if velocity.x < 0 and other.end.x == current.position.x:
		return _overlap(current.position.y, current.end.y, other.position.y, other.end.y)
	if velocity.y > 0 and other.position.y == current.end.y:
		return _overlap(current.position.x, current.end.x, other.position.x, other.end.x)
	if velocity.y < 0 and other.end.y == current.position.y:
		return _overlap(current.position.x, current.end.x, other.position.x, other.end.x)
	return false


static func _overlap(start_a: int, end_a: int, start_b: int, end_b: int) -> bool:
	return start_a < end_b and start_b < end_a


static func _land(origin: Vector2i, window_size: Vector2i, other: Rect2i, velocity: Vector2i) -> Vector2i:
	var landed := origin
	if velocity.x > 0:
		landed.x = other.position.x
	elif velocity.x < 0:
		landed.x = other.end.x - window_size.x
	else:
		landed.x = clampi(origin.x, other.position.x, other.end.x - window_size.x)
	if velocity.y > 0:
		landed.y = other.position.y
	elif velocity.y < 0:
		landed.y = other.end.y - window_size.y
	else:
		landed.y = clampi(origin.y, other.position.y, other.end.y - window_size.y)
	return landed
