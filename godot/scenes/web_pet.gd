extends Node2D

@onready var name_label: Label = %NameLabel
@onready var level_label: Label = %LevelLabel
@onready var slime: Polygon2D = %Slime
var base_y := 0.0

func _ready() -> void:
	base_y = slime.position.y
	var pet := "baby_slime"
	var level := "1"
	if OS.has_feature("web"):
		var query := str(JavaScriptBridge.eval("window.location.search", true))
		var parsed := _parse_query(query)
		if parsed.has("pet") and str(parsed["pet"]) != "":
			pet = str(parsed["pet"])
		if parsed.has("level") and str(parsed["level"]) != "":
			level = str(parsed["level"])
	name_label.text = _pretty(pet)
	level_label.text = "Level %s" % level

func _process(_delta: float) -> void:
	slime.position.y = base_y + sin(Time.get_ticks_msec() / 320.0) * 8.0

func _parse_query(query: String) -> Dictionary:
	var result := {}
	var trimmed := query
	if trimmed.begins_with("?"):
		trimmed = trimmed.substr(1)
	if trimmed.is_empty():
		return result
	for part in trimmed.split("&", false):
		var bits := part.split("=", true, 1)
		if bits.size() == 2:
			result[_decode(bits[0])] = _decode(bits[1])
	return result

func _decode(value: String) -> String:
	return value.replace("+", " ").uri_decode()

func _pretty(pet: String) -> String:
	var words: PackedStringArray = []
	for piece in pet.split("_", false):
		if piece.is_empty():
			continue
		words.append(piece.substr(0, 1).to_upper() + piece.substr(1))
	if words.is_empty():
		return pet
	return " ".join(words)
