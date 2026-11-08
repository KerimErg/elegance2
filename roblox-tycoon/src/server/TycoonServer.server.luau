-- TycoonServer (Script, dans ServerScriptService)
-- Construit les usines, gère les achats, l'argent, les renaissances et la sauvegarde.

local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local ServerScriptService = game:GetService("ServerScriptService")
local DataStoreService = game:GetService("DataStoreService")
local Debris = game:GetService("Debris")

local Config = require(ServerScriptService:WaitForChild("TycoonConfig"))

local L = Config.Layout
local C = Config.Colors
local TOP = 0.5 -- hauteur du dessus du sol de l'usine (en local)

---------------------------------------------------------------------
-- Événements réseau (pour parler à l'interface du joueur)
---------------------------------------------------------------------
local remotes = Instance.new("Folder")
remotes.Name = "TycoonRemotes"

local notifyEvent = Instance.new("RemoteEvent")
notifyEvent.Name = "Notify"
notifyEvent.Parent = remotes

local askRebirthEvent = Instance.new("RemoteEvent")
askRebirthEvent.Name = "AskRebirth"
askRebirthEvent.Parent = remotes

local confirmRebirthEvent = Instance.new("RemoteEvent")
confirmRebirthEvent.Name = "ConfirmRebirth"
confirmRebirthEvent.Parent = remotes

remotes.Parent = ReplicatedStorage

---------------------------------------------------------------------
-- Vérification de la config
---------------------------------------------------------------------
local itemsById = {}
for index, item in ipairs(Config.Items) do
	if itemsById[item.id] then
		warn("[Tycoon] id en double dans TycoonConfig : " .. item.id)
	end
	if item.requires and not itemsById[item.requires] then
		warn("[Tycoon] '" .. item.id .. "' demande '" .. item.requires .. "' qui doit être placé AVANT dans la liste")
	end
	item.index = index
	itemsById[item.id] = item
end

---------------------------------------------------------------------
-- Sauvegarde
---------------------------------------------------------------------
local store = nil
do
	local ok, result = pcall(function()
		return DataStoreService:GetDataStore(Config.DataStoreName)
	end)
	if ok then
		store = result
	else
		warn("[Tycoon] Sauvegarde désactivée : " .. tostring(result))
	end
end

---------------------------------------------------------------------
-- Petites fonctions utiles
---------------------------------------------------------------------
local sessions = {} -- [player] = { plot, canSave, loaded, lastTouch }
local plots = {}

local function money(n)
	return Config.FormatNumber(n) .. " " .. Config.CurrencySymbol
end

local function notify(player, text, kind)
	notifyEvent:FireClient(player, text, kind or "info")
end

local function makePart(parent, cframe, props)
	local part = Instance.new("Part")
	part.Anchored = true
	part.TopSurface = Enum.SurfaceType.Smooth
	part.BottomSurface = Enum.SurfaceType.Smooth
	part.Material = Enum.Material.SmoothPlastic
	for key, value in pairs(props) do
		part[key] = value
	end
	part.CFrame = cframe -- toujours en dernier (après Size)
	part.Parent = parent
	return part
end

local function makeBillboard(adornee, text, offsetY, size)
	local gui = Instance.new("BillboardGui")
	gui.Size = size or UDim2.fromOffset(220, 60)
	gui.StudsOffset = Vector3.new(0, offsetY or 3, 0)
	gui.MaxDistance = 80
	local label = Instance.new("TextLabel")
	label.Size = UDim2.fromScale(1, 1)
	label.BackgroundTransparency = 1
	label.TextScaled = true
	label.Font = Enum.Font.FredokaOne
	label.TextColor3 = Color3.new(1, 1, 1)
	label.TextStrokeTransparency = 0.2
	label.Text = text
	label.Parent = gui
	gui.Parent = adornee
	return label
end

local function rel(plot, x, y, z)
	return plot.cframe * CFrame.new(x, y, z)
end

local function getCash(player)
	return player.leaderstats.Argent
end

local function getRebirths(player)
	return player.leaderstats.Renaissances
end

local function getMultiplier(player)
	return 1 + getRebirths(player).Value * Config.RebirthBonus
end

local function playerFromHit(hit)
	local character = hit:FindFirstAncestorOfClass("Model")
	if not character then
		return nil
	end
	local humanoid = character:FindFirstChildOfClass("Humanoid")
	if not humanoid or humanoid.Health <= 0 then
		return nil
	end
	return Players:GetPlayerFromCharacter(character)
end

-- Évite qu'un bouton se déclenche 20 fois quand on marche dessus
local function debounce(player, key, delay)
	local session = sessions[player]
	if not session then
		return false
	end
	local now = os.clock()
	if session.lastTouch[key] and now - session.lastTouch[key] < delay then
		return false
	end
	session.lastTouch[key] = now
	return true
end

---------------------------------------------------------------------
-- Affichage
---------------------------------------------------------------------
local function updateBank(plot)
	plot.bankLabel.Text = "RÉCOLTER\n" .. money(plot.bank)
end

local function rebirthPrice(player)
	return Config.RebirthBasePrice * (getRebirths(player).Value + 1)
end

local function updateRebirthLabel(plot)
	local owner = plot.owner
	if not owner then
		plot.rebirthLabel.Text = "RENAISSANCE"
		return
	end
	local current = getMultiplier(owner)
	plot.rebirthLabel.Text = string.format(
		"RENAISSANCE\n%s\nGains x%s → x%s",
		money(rebirthPrice(owner)),
		tostring(current),
		tostring(current + Config.RebirthBonus)
	)
end

local function updateMultiplier(player)
	player:SetAttribute("Multiplier", getMultiplier(player))
end

local function updateButtonColors(plot)
	if not plot.owner then
		return
	end
	local cash = getCash(plot.owner).Value
	for id, pad in pairs(plot.buttons) do
		local item = itemsById[id]
		pad.Color = cash >= item.price and C.ButtonAffordable or C.ButtonTooExpensive
	end
end

local function applyConveyorSpeed(plot)
	local direction = plot.cframe:VectorToWorldSpace(Vector3.new(1, 0, 0))
	plot.conveyor.AssemblyLinearVelocity = direction * plot.conveyorSpeed
end

---------------------------------------------------------------------
-- Bonbons
---------------------------------------------------------------------
local function spawnDrop(plot, spout, item)
	if plot.dropCount >= Config.MaxDropsPerPlot then
		return
	end
	local drop = makePart(plot.dropsFolder, spout.CFrame * CFrame.new(0, -1.2, 0), {
		Name = "Drop",
		Shape = Enum.PartType.Ball,
		Size = Vector3.new(1.2, 1.2, 1.2),
		Color = item.dropColor or Color3.new(1, 1, 1),
		Anchored = false,
	})
	drop:SetAttribute("Value", item.value)
	drop:SetAttribute("Plot", plot.index)
	pcall(function()
		drop:SetNetworkOwner(nil) -- le serveur gère la physique (anti-triche)
	end)

	plot.dropCount += 1
	local counted = true
	drop.Destroying:Connect(function()
		if counted then
			counted = false
			plot.dropCount -= 1
		end
	end)
	Debris:AddItem(drop, Config.DropLifetime)
end

---------------------------------------------------------------------
-- Construction des achats
---------------------------------------------------------------------
local builders = {}

function builders.dropper(plot, item)
	local folder = plot.itemsFolder
	local x, z = item.x, L.ConveyorZ
	local color = item.color or C.Dropper

	local body = makePart(folder, rel(plot, x, TOP + 7.5, z), {
		Name = item.id,
		Size = Vector3.new(4, 3, 8.6),
		Color = color,
	})
	local spout = makePart(folder, rel(plot, x, TOP + 5.5, z), {
		Size = Vector3.new(1.6, 1, 1.6),
		Color = C.Spout,
		Material = Enum.Material.Metal,
	})
	for _, dz in ipairs({ -3.9, 3.9 }) do
		makePart(folder, rel(plot, x, TOP + 3, z + dz), {
			Size = Vector3.new(0.8, 6, 0.8),
			Color = C.Spout,
			Material = Enum.Material.Metal,
		})
	end
	makeBillboard(body, item.name, 3, UDim2.fromOffset(180, 40))

	local version = plot.version
	task.spawn(function()
		while plot.version == version and body.Parent do
			task.wait(item.interval)
			if plot.version ~= version or not body.Parent then
				break
			end
			spawnDrop(plot, spout, item)
		end
	end)
end

function builders.upgrader(plot, item)
	local folder = plot.itemsFolder
	local x, z = item.x, L.ConveyorZ

	local zone = makePart(folder, rel(plot, x, TOP + 3, z), {
		Name = item.id,
		Size = Vector3.new(1.5, 3, 6),
		Color = item.color,
		Material = Enum.Material.Neon,
		Transparency = 0.5,
		CanCollide = false,
	})
	for _, dz in ipairs({ -3.9, 3.9 }) do
		makePart(folder, rel(plot, x, TOP + 2.5, z + dz), {
			Size = Vector3.new(0.8, 5, 0.8),
			Color = item.color,
		})
	end
	makePart(folder, rel(plot, x, TOP + 5.2, z), {
		Size = Vector3.new(1.2, 0.8, 8.6),
		Color = item.color,
	})
	makeBillboard(zone, item.name, 4, UDim2.fromOffset(160, 36))

	local tag = "Up_" .. item.id
	zone.Touched:Connect(function(hit)
		if hit.Name ~= "Drop" or hit:GetAttribute("Plot") ~= plot.index or hit:GetAttribute(tag) then
			return
		end
		hit:SetAttribute(tag, true)
		hit:SetAttribute("Value", (hit:GetAttribute("Value") or 0) * item.multiplier)
		hit.Color = item.color
		hit.Material = Enum.Material.Neon
	end)
end

function builders.speed(plot, item)
	plot.conveyorSpeed = math.max(plot.conveyorSpeed, item.speed)
	applyConveyorSpeed(plot)
end

function builders.part(plot, item)
	makePart(plot.itemsFolder, rel(plot, item.offset.X, item.offset.Y, item.offset.Z), {
		Name = item.id,
		Size = item.size,
		Color = item.color or Color3.new(1, 1, 1),
		Material = item.material or Enum.Material.SmoothPlastic,
	})
end

local function buildItem(plot, item)
	local builder = builders[item.type]
	if builder then
		builder(plot, item)
	else
		warn("[Tycoon] type inconnu : " .. tostring(item.type))
	end
end

---------------------------------------------------------------------
-- Boutons d'achat
---------------------------------------------------------------------
local refreshButtons -- déclaré plus bas

local function purchase(plot, item)
	plot.purchased[item.id] = true
	buildItem(plot, item)
	refreshButtons(plot)
	updateButtonColors(plot)
end

local function tryBuy(plot, item, player)
	if plot.owner ~= player or plot.purchased[item.id] then
		return
	end
	if item.requires and not plot.purchased[item.requires] then
		return
	end
	local cash = getCash(player)
	if cash.Value < item.price then
		notify(player, "Il te manque " .. money(item.price - cash.Value) .. " !", "error")
		return
	end
	cash.Value -= item.price
	purchase(plot, item)
	notify(player, item.name .. " acheté !", "success")
end

local function createButton(plot, item)
	local row = (item.index - 1) // L.ButtonsPerRow
	local col = (item.index - 1) % L.ButtonsPerRow
	local x = L.ButtonStart.X + col * L.ButtonSpacing
	local z = L.ButtonStart.Z - row * L.ButtonSpacing

	local pad = makePart(plot.buttonsFolder, rel(plot, x, TOP + 0.2, z), {
		Name = "Button_" .. item.id,
		Size = Vector3.new(4, 0.4, 4),
		Color = C.ButtonTooExpensive,
		Material = Enum.Material.Neon,
	})
	local priceText = item.price == 0 and "GRATUIT" or money(item.price)
	makeBillboard(pad, item.name .. "\n" .. priceText, 2.5)

	pad.Touched:Connect(function(hit)
		local player = playerFromHit(hit)
		if player and debounce(player, "btn_" .. item.id, 0.6) then
			tryBuy(plot, item, player)
		end
	end)
	plot.buttons[item.id] = pad
end

function refreshButtons(plot)
	for _, item in ipairs(Config.Items) do
		local shouldShow = plot.owner ~= nil
			and not plot.purchased[item.id]
			and (item.requires == nil or plot.purchased[item.requires] == true)
		local existing = plot.buttons[item.id]
		if shouldShow and not existing then
			createButton(plot, item)
		elseif not shouldShow and existing then
			existing:Destroy()
			plot.buttons[item.id] = nil
		end
	end
end

---------------------------------------------------------------------
-- Création des usines
---------------------------------------------------------------------
local tycoonsFolder = Instance.new("Folder")
tycoonsFolder.Name = "Tycoons"
tycoonsFolder.Parent = workspace

local function resetPlot(plot)
	plot.version += 1 -- arrête les machines en cours
	plot.itemsFolder:ClearAllChildren()
	plot.dropsFolder:ClearAllChildren()
	for _, pad in pairs(plot.buttons) do
		pad:Destroy()
	end
	plot.buttons = {}
	plot.purchased = {}
	plot.bank = 0
	plot.conveyorSpeed = Config.BaseConveyorSpeed
	applyConveyorSpeed(plot)
	updateBank(plot)
end

local function createPlot(index)
	local angle = (index - 1) * (2 * math.pi / Config.NumPlots)
	local position = Vector3.new(math.cos(angle) * Config.PlotDistance, TOP, math.sin(angle) * Config.PlotDistance)
	-- l'avant de l'usine (-Z) regarde le centre de la carte
	local cframe = CFrame.lookAt(position, Vector3.new(0, TOP, 0))

	local model = Instance.new("Model")
	model.Name = "Tycoon_" .. index

	local plot = {
		index = index,
		cframe = cframe,
		model = model,
		owner = nil,
		purchased = {},
		buttons = {},
		bank = 0,
		dropCount = 0,
		version = 0,
		conveyorSpeed = Config.BaseConveyorSpeed,
	}

	-- Sol
	local ground = makePart(model, cframe, {
		Name = "Ground",
		Size = Vector3.new(L.PlotSize, 1, L.PlotSize),
		Color = C.Ground,
	})
	model.PrimaryPart = ground

	-- Tapis roulant
	local length = L.ConveyorEndX - L.ConveyorStartX
	local centerX = (L.ConveyorEndX + L.ConveyorStartX) / 2
	plot.conveyor = makePart(model, rel(plot, centerX, TOP + 0.5, L.ConveyorZ), {
		Name = "Conveyor",
		Size = Vector3.new(length, 1, 6),
		Color = C.Conveyor,
		Material = Enum.Material.DiamondPlate,
	})
	for _, dz in ipairs({ -3.25, 3.25 }) do
		makePart(model, rel(plot, centerX, TOP + 1.25, L.ConveyorZ + dz), {
			Size = Vector3.new(length, 1.5, 0.5),
			Color = C.Rail,
		})
	end
	makePart(model, rel(plot, L.ConveyorStartX - 0.25, TOP + 1.25, L.ConveyorZ), {
		Size = Vector3.new(0.5, 1.5, 7),
		Color = C.Rail,
	})
	applyConveyorSpeed(plot)

	-- Collecteur (au bout du tapis)
	local collector = makePart(model, rel(plot, L.CollectorX, TOP + 0.8, L.ConveyorZ), {
		Name = "Collector",
		Size = Vector3.new(4, 1.6, 6),
		Color = C.Collector,
		Material = Enum.Material.Neon,
	})
	collector.Touched:Connect(function(hit)
		if hit.Name ~= "Drop" or hit:GetAttribute("Plot") ~= plot.index or hit:GetAttribute("Collected") then
			return
		end
		hit:SetAttribute("Collected", true)
		if plot.owner then
			local value = hit:GetAttribute("Value") or 0
			plot.bank += math.floor(value * getMultiplier(plot.owner) + 0.5)
			updateBank(plot)
		end
		hit:Destroy()
	end)

	-- Plaque pour récolter l'argent
	local collectPad = makePart(model, rel(plot, L.CollectPad.X, TOP + 0.2, L.CollectPad.Z), {
		Name = "CollectPad",
		Size = Vector3.new(6, 0.4, 6),
		Color = C.CollectPad,
		Material = Enum.Material.Neon,
	})
	plot.bankLabel = makeBillboard(collectPad, "", 3)
	collectPad.Touched:Connect(function(hit)
		local player = playerFromHit(hit)
		if not player or player ~= plot.owner or plot.bank <= 0 then
			return
		end
		if not debounce(player, "collect", 0.3) then
			return
		end
		local amount = plot.bank
		plot.bank = 0
		getCash(player).Value += amount
		updateBank(plot)
		notify(player, "+" .. money(amount), "money")
	end)

	-- Plaque de renaissance
	local rebirthPad = makePart(model, rel(plot, L.RebirthPad.X, TOP + 0.2, L.RebirthPad.Z), {
		Name = "RebirthPad",
		Size = Vector3.new(6, 0.4, 6),
		Color = C.RebirthPad,
		Material = Enum.Material.Neon,
	})
	plot.rebirthLabel = makeBillboard(rebirthPad, "", 3.5, UDim2.fromOffset(220, 80))
	rebirthPad.Touched:Connect(function(hit)
		local player = playerFromHit(hit)
		if not player or player ~= plot.owner or not debounce(player, "rebirthPad", 3) then
			return
		end
		local price = rebirthPrice(player)
		if getCash(player).Value < price then
			notify(player, "Renaissance : il te faut " .. money(price), "error")
			return
		end
		askRebirthEvent:FireClient(player, price, getMultiplier(player) + Config.RebirthBonus)
	end)

	-- Panneau avec le nom du propriétaire
	for _, dx in ipairs({ -6.5, 6.5 }) do
		makePart(model, rel(plot, L.Sign.X + dx, TOP + 3, L.Sign.Z), {
			Size = Vector3.new(0.6, 6, 0.6),
			Color = C.Spout,
		})
	end
	local board = makePart(model, rel(plot, L.Sign.X, TOP + 7, L.Sign.Z), {
		Name = "Sign",
		Size = Vector3.new(14, 4, 0.6),
		Color = C.Sign,
	})
	local surface = Instance.new("SurfaceGui")
	surface.Face = Enum.NormalId.Front
	surface.SizingMode = Enum.SurfaceGuiSizingMode.PixelsPerStud
	surface.PixelsPerStud = 40
	local signLabel = Instance.new("TextLabel")
	signLabel.Size = UDim2.fromScale(1, 1)
	signLabel.BackgroundTransparency = 1
	signLabel.TextScaled = true
	signLabel.Font = Enum.Font.FredokaOne
	signLabel.TextColor3 = Color3.fromRGB(255, 80, 160)
	signLabel.Text = "Usine libre"
	signLabel.Parent = surface
	surface.Parent = board
	plot.signLabel = signLabel

	-- Dossiers pour les achats, les boutons et les bonbons
	plot.itemsFolder = Instance.new("Folder")
	plot.itemsFolder.Name = "Items"
	plot.itemsFolder.Parent = model
	plot.buttonsFolder = Instance.new("Folder")
	plot.buttonsFolder.Name = "Buttons"
	plot.buttonsFolder.Parent = model
	plot.dropsFolder = Instance.new("Folder")
	plot.dropsFolder.Name = "Drops"
	plot.dropsFolder.Parent = model

	updateBank(plot)
	updateRebirthLabel(plot)
	model.Parent = tycoonsFolder
	return plot
end

-- Sol et point d'apparition si la carte est vide
if not workspace:FindFirstChild("Baseplate") then
	makePart(workspace, CFrame.new(0, -8, 0), {
		Name = "Baseplate",
		Size = Vector3.new(512, 16, 512),
		Color = Color3.fromRGB(110, 200, 110),
		Material = Enum.Material.Grass,
	})
end
if not workspace:FindFirstChildWhichIsA("SpawnLocation", true) then
	local spawn = Instance.new("SpawnLocation")
	spawn.Anchored = true
	spawn.Size = Vector3.new(12, 1, 12)
	spawn.CFrame = CFrame.new(0, 0.5, 0)
	spawn.Parent = workspace
end

for i = 1, Config.NumPlots do
	plots[i] = createPlot(i)
end

---------------------------------------------------------------------
-- Joueurs
---------------------------------------------------------------------
local function dataKey(player)
	return "player_" .. player.UserId
end

local function loadData(player)
	if not store then
		return {}, false
	end
	for attempt = 1, 3 do
		local ok, result = pcall(store.GetAsync, store, dataKey(player))
		if ok then
			return result or {}, true
		end
		warn("[Tycoon] Échec du chargement (" .. attempt .. "/3) : " .. tostring(result))
		task.wait(2)
	end
	return {}, false
end

local function saveData(player)
	local session = sessions[player]
	if not store or not session or not session.canSave or not session.loaded then
		return
	end
	local purchased = {}
	local bank = 0
	if session.plot then
		for id in pairs(session.plot.purchased) do
			table.insert(purchased, id)
		end
		bank = session.plot.bank
	end
	local data = {
		cash = getCash(player).Value,
		rebirths = getRebirths(player).Value,
		bank = bank,
		purchased = purchased,
	}
	local ok, err = pcall(store.SetAsync, store, dataKey(player), data)
	if not ok then
		warn("[Tycoon] Échec de la sauvegarde de " .. player.Name .. " : " .. tostring(err))
	end
end

local function sendHome(player)
	local session = sessions[player]
	local character = player.Character
	if not session or not session.plot or not character then
		return
	end
	local root = character:WaitForChild("HumanoidRootPart", 5)
	if not root then
		return
	end
	task.wait()
	character:PivotTo(rel(session.plot, L.Spawn.X, L.Spawn.Y, L.Spawn.Z) * CFrame.Angles(0, math.pi, 0))
end

local function claimPlot(player, data)
	local plot = nil
	for _, candidate in ipairs(plots) do
		if not candidate.owner then
			plot = candidate
			break
		end
	end
	if not plot then
		return nil
	end

	plot.owner = player
	plot.signLabel.Text = "Usine de " .. player.DisplayName

	-- Reconstruit ce que le joueur avait acheté
	local saved = {}
	for _, id in ipairs(data.purchased or {}) do
		saved[id] = true
	end
	for _, item in ipairs(Config.Items) do
		if saved[item.id] and (item.requires == nil or plot.purchased[item.requires]) then
			plot.purchased[item.id] = true
			buildItem(plot, item)
		end
	end

	plot.bank = data.bank or 0
	refreshButtons(plot)
	updateBank(plot)
	updateRebirthLabel(plot)
	updateButtonColors(plot)
	return plot
end

local function releasePlot(plot)
	resetPlot(plot)
	plot.owner = nil
	plot.signLabel.Text = "Usine libre"
	refreshButtons(plot)
	updateRebirthLabel(plot)
end

local function onPlayerAdded(player)
	local session = { plot = nil, canSave = false, loaded = false, lastTouch = {} }
	sessions[player] = session

	local leaderstats = Instance.new("Folder")
	leaderstats.Name = "leaderstats"
	local cash = Instance.new("IntValue")
	cash.Name = "Argent"
	cash.Parent = leaderstats
	local rebirths = Instance.new("IntValue")
	rebirths.Name = "Renaissances"
	rebirths.Parent = leaderstats
	leaderstats.Parent = player

	player.CharacterAdded:Connect(function()
		sendHome(player)
	end)

	local data, canSave = loadData(player)
	if sessions[player] ~= session then
		return -- le joueur est parti pendant le chargement
	end
	session.canSave = canSave
	cash.Value = data.cash or Config.StartingCash
	rebirths.Value = data.rebirths or 0
	updateMultiplier(player)

	session.plot = claimPlot(player, data)
	session.loaded = true

	cash.Changed:Connect(function()
		if session.plot then
			updateButtonColors(session.plot)
		end
	end)

	if not session.plot then
		notify(player, "Toutes les usines sont prises, désolé !", "error")
		return
	end

	task.spawn(sendHome, player)
	notify(player, "Bienvenue dans " .. Config.GameName .. " !", "success")
	if not canSave then
		notify(player, "Sauvegarde indisponible : ta progression ne sera pas enregistrée.", "error")
	end
end

local function onPlayerRemoving(player)
	local session = sessions[player]
	if not session then
		return
	end
	saveData(player)
	if session.plot then
		releasePlot(session.plot)
	end
	sessions[player] = nil
end

confirmRebirthEvent.OnServerEvent:Connect(function(player)
	local session = sessions[player]
	if not session or not session.plot or not debounce(player, "rebirthConfirm", 2) then
		return
	end
	local cash = getCash(player)
	local price = rebirthPrice(player)
	if cash.Value < price then
		notify(player, "Pas assez d'argent pour renaître.", "error")
		return
	end

	getRebirths(player).Value += 1
	cash.Value = Config.StartingCash
	updateMultiplier(player)

	local plot = session.plot
	resetPlot(plot)
	refreshButtons(plot)
	updateButtonColors(plot)
	updateRebirthLabel(plot)

	notify(player, "Renaissance ! Tes gains sont maintenant x" .. tostring(getMultiplier(player)), "success")
	task.spawn(saveData, player)
	task.spawn(sendHome, player)
end)

Players.PlayerAdded:Connect(onPlayerAdded)
Players.PlayerRemoving:Connect(onPlayerRemoving)
for _, player in ipairs(Players:GetPlayers()) do
	task.spawn(onPlayerAdded, player)
end

-- Sauvegarde automatique
task.spawn(function()
	while true do
		task.wait(Config.AutoSaveInterval)
		for _, player in ipairs(Players:GetPlayers()) do
			task.spawn(saveData, player)
		end
	end
end)

-- Sauvegarde quand le serveur s'arrête
game:BindToClose(function()
	local pending = 0
	for _, player in ipairs(Players:GetPlayers()) do
		pending += 1
		task.spawn(function()
			saveData(player)
			pending -= 1
		end)
	end
	local start = os.clock()
	while pending > 0 and os.clock() - start < 25 do
		task.wait(0.1)
	end
end)
