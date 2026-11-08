-- TycoonConfig (ModuleScript, dans ServerScriptService)
-- Tous les réglages du jeu sont ici : prix, machines, couleurs...
-- Tu peux modifier ce fichier sans toucher au reste du code.

local Config = {}

Config.GameName = "Bonbon Tycoon"
Config.CurrencySymbol = "$"

-- Argent au début (la première machine est gratuite)
Config.StartingCash = 0

-- Nombre d'usines (= nombre max de joueurs par serveur)
Config.NumPlots = 4
-- Distance entre le centre de la carte et chaque usine
Config.PlotDistance = 90

-- Bonbons
Config.MaxDropsPerPlot = 80 -- limite pour éviter le lag
Config.DropLifetime = 30 -- secondes avant qu'un bonbon perdu disparaisse

-- Tapis roulant
Config.BaseConveyorSpeed = 8

-- Renaissance (rebirth) : remet l'usine à zéro mais augmente les gains
Config.RebirthBasePrice = 100000 -- prix de la 1re renaissance (x2 pour la 2e, x3 pour la 3e...)
Config.RebirthBonus = 0.5 -- +50 % de gains par renaissance

-- Sauvegarde
Config.DataStoreName = "BonbonTycoon_v1"
Config.AutoSaveInterval = 60

Config.Colors = {
	Ground = Color3.fromRGB(255, 214, 231),
	Conveyor = Color3.fromRGB(60, 60, 70),
	Rail = Color3.fromRGB(255, 255, 255),
	Collector = Color3.fromRGB(255, 196, 0),
	CollectPad = Color3.fromRGB(0, 200, 120),
	RebirthPad = Color3.fromRGB(170, 85, 255),
	ButtonAffordable = Color3.fromRGB(0, 220, 90),
	ButtonTooExpensive = Color3.fromRGB(230, 60, 60),
	Dropper = Color3.fromRGB(255, 105, 180),
	Spout = Color3.fromRGB(120, 120, 130),
	Sign = Color3.fromRGB(255, 255, 255),
}

-- Positions dans l'usine (en studs, par rapport au centre de l'usine).
-- X = gauche/droite, Z = avant (négatif, côté centre de la carte) / arrière (positif).
Config.Layout = {
	PlotSize = 64,
	ConveyorZ = 10,
	ConveyorStartX = -26,
	ConveyorEndX = 21.5,
	CollectorX = 23.5,
	CollectPad = Vector3.new(24, 0, -6),
	RebirthPad = Vector3.new(-24, 0, -8),
	Spawn = Vector3.new(0, 4, -12),
	Sign = Vector3.new(0, 0, -31),
	ButtonStart = Vector3.new(-24, 0, -20),
	ButtonSpacing = 7,
	ButtonsPerRow = 8,
}

--[[
	Liste des achats, dans l'ordre. Chaque achat a :
	  id        : identifiant unique (ne pas le changer après la sortie, sinon la sauvegarde le perd)
	  name      : nom affiché sur le bouton
	  price     : prix
	  requires  : id de l'achat qu'il faut avoir avant (nil = disponible tout de suite)
	  type      : "dropper"  -> machine qui fait tomber des bonbons
	                (x, value = valeur d'un bonbon, interval = secondes entre deux bonbons,
	                 color, dropColor)
	              "upgrader" -> arche qui multiplie la valeur des bonbons (x, multiplier, color)
	              "speed"    -> tapis plus rapide (speed)
	              "part"     -> décor (offset, size, color, material)
]]
Config.Items = {
	{
		id = "dropper_1", name = "Petite machine", price = 0, type = "dropper",
		x = -22, value = 1, interval = 1.5,
		color = Color3.fromRGB(255, 150, 200), dropColor = Color3.fromRGB(255, 120, 180),
	},
	{
		id = "dropper_2", name = "Machine à sucettes", price = 40, requires = "dropper_1", type = "dropper",
		x = -15, value = 3, interval = 1.5,
		color = Color3.fromRGB(255, 90, 90), dropColor = Color3.fromRGB(255, 60, 60),
	},
	{
		id = "wall_left", name = "Mur gauche", price = 120, requires = "dropper_2", type = "part",
		offset = Vector3.new(-31.5, 5.5, 0), size = Vector3.new(1, 10, 64),
		color = Color3.fromRGB(255, 182, 193), material = Enum.Material.SmoothPlastic,
	},
	{
		id = "upgrader_1", name = "Glaçage x2", price = 300, requires = "dropper_2", type = "upgrader",
		x = 11, multiplier = 2, color = Color3.fromRGB(0, 200, 255),
	},
	{
		id = "dropper_3", name = "Machine à guimauves", price = 750, requires = "upgrader_1", type = "dropper",
		x = -8, value = 8, interval = 1.4,
		color = Color3.fromRGB(240, 240, 255), dropColor = Color3.fromRGB(255, 255, 255),
	},
	{
		id = "speed_1", name = "Tapis rapide", price = 1500, requires = "dropper_3", type = "speed",
		speed = 13,
	},
	{
		id = "wall_right", name = "Mur droit", price = 2000, requires = "dropper_3", type = "part",
		offset = Vector3.new(31.5, 5.5, 0), size = Vector3.new(1, 10, 64),
		color = Color3.fromRGB(255, 182, 193), material = Enum.Material.SmoothPlastic,
	},
	{
		id = "dropper_4", name = "Machine à chocolat", price = 4000, requires = "speed_1", type = "dropper",
		x = -1, value = 20, interval = 1.3,
		color = Color3.fromRGB(120, 70, 40), dropColor = Color3.fromRGB(90, 50, 25),
	},
	{
		id = "wall_back", name = "Mur du fond", price = 6000, requires = "dropper_4", type = "part",
		offset = Vector3.new(0, 5.5, 31.5), size = Vector3.new(64, 10, 1),
		color = Color3.fromRGB(255, 160, 200), material = Enum.Material.SmoothPlastic,
	},
	{
		id = "upgrader_2", name = "Paillettes x3", price = 10000, requires = "dropper_4", type = "upgrader",
		x = 17, multiplier = 3, color = Color3.fromRGB(255, 220, 0),
	},
	{
		id = "dropper_5", name = "Méga usine", price = 25000, requires = "upgrader_2", type = "dropper",
		x = 5, value = 60, interval = 1.2,
		color = Color3.fromRGB(150, 80, 255), dropColor = Color3.fromRGB(190, 120, 255),
	},
	{
		id = "speed_2", name = "Tapis turbo", price = 40000, requires = "dropper_5", type = "speed",
		speed = 18,
	},
	{
		id = "tower", name = "Tour bonbon", price = 60000, requires = "dropper_5", type = "part",
		offset = Vector3.new(26, 10.5, 26), size = Vector3.new(6, 20, 6),
		color = Color3.fromRGB(255, 80, 160), material = Enum.Material.Neon,
	},
}

-- Affiche les grands nombres joliment : 1500 -> 1.5K, 2000000 -> 2M
function Config.FormatNumber(n: number): string
	n = math.floor(n)
	local suffixes = { "", "K", "M", "B", "T", "Qa", "Qi" }
	local i = 1
	local x = n
	while math.abs(x) >= 1000 and i < #suffixes do
		x /= 1000
		i += 1
	end
	if i == 1 then
		return tostring(n)
	end
	local text = string.format("%.1f%s", x, suffixes[i])
	text = text:gsub("%.0(%a)", "%1")
	return text
end

return Config
