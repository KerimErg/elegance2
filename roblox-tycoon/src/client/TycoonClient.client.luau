-- TycoonClient (LocalScript, dans StarterPlayer > StarterPlayerScripts)
-- Interface : compteur d'argent, notifications et fenêtre de renaissance.

local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local TweenService = game:GetService("TweenService")

local player = Players.LocalPlayer
local remotes = ReplicatedStorage:WaitForChild("TycoonRemotes")

local CURRENCY = "$"
local PINK = Color3.fromRGB(255, 80, 160)

local function formatNumber(n)
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

local function corner(parent, radius)
	local c = Instance.new("UICorner")
	c.CornerRadius = UDim.new(0, radius or 12)
	c.Parent = parent
end

local function label(parent, props)
	local l = Instance.new("TextLabel")
	l.BackgroundTransparency = 1
	l.Font = Enum.Font.FredokaOne
	l.TextColor3 = Color3.new(1, 1, 1)
	l.TextScaled = true
	for k, v in pairs(props) do
		l[k] = v
	end
	l.Parent = parent
	return l
end

---------------------------------------------------------------------
-- Écran
---------------------------------------------------------------------
local gui = Instance.new("ScreenGui")
gui.Name = "TycoonGui"
gui.ResetOnSpawn = false
gui.ZIndexBehavior = Enum.ZIndexBehavior.Sibling
gui.Parent = player:WaitForChild("PlayerGui")

-- Compteur d'argent (en haut)
local cashFrame = Instance.new("Frame")
cashFrame.AnchorPoint = Vector2.new(0.5, 0)
cashFrame.Position = UDim2.new(0.5, 0, 0, 12)
cashFrame.Size = UDim2.fromOffset(240, 64)
cashFrame.BackgroundColor3 = Color3.fromRGB(30, 20, 40)
cashFrame.BackgroundTransparency = 0.15
cashFrame.Parent = gui
corner(cashFrame, 16)
local stroke = Instance.new("UIStroke")
stroke.Color = PINK
stroke.Thickness = 3
stroke.Parent = cashFrame

local cashLabel = label(cashFrame, {
	Size = UDim2.new(1, -16, 0.65, 0),
	Position = UDim2.fromOffset(8, 4),
	Text = "0 " .. CURRENCY,
	TextColor3 = Color3.fromRGB(120, 255, 150),
})
local multLabel = label(cashFrame, {
	Size = UDim2.new(1, -16, 0.3, 0),
	Position = UDim2.new(0, 8, 0.65, 0),
	Text = "Gains x1",
	TextColor3 = Color3.fromRGB(230, 200, 255),
})

-- Zone des notifications
local toastArea = Instance.new("Frame")
toastArea.AnchorPoint = Vector2.new(0.5, 0)
toastArea.Position = UDim2.new(0.5, 0, 0, 86)
toastArea.Size = UDim2.fromOffset(360, 300)
toastArea.BackgroundTransparency = 1
toastArea.Parent = gui
local list = Instance.new("UIListLayout")
list.HorizontalAlignment = Enum.HorizontalAlignment.Center
list.Padding = UDim.new(0, 6)
list.SortOrder = Enum.SortOrder.LayoutOrder
list.Parent = toastArea

local toastColors = {
	success = Color3.fromRGB(0, 170, 90),
	error = Color3.fromRGB(200, 50, 60),
	money = Color3.fromRGB(230, 170, 0),
	info = Color3.fromRGB(80, 80, 120),
}

local toastOrder = 0
local function showToast(text, kind)
	toastOrder += 1
	local toast = Instance.new("TextLabel")
	toast.LayoutOrder = toastOrder
	toast.Size = UDim2.fromOffset(340, 40)
	toast.BackgroundColor3 = toastColors[kind] or toastColors.info
	toast.Font = Enum.Font.FredokaOne
	toast.TextColor3 = Color3.new(1, 1, 1)
	toast.TextScaled = true
	toast.Text = text
	toast.Parent = toastArea
	corner(toast, 10)
	local pad = Instance.new("UIPadding")
	pad.PaddingLeft = UDim.new(0, 10)
	pad.PaddingRight = UDim.new(0, 10)
	pad.PaddingTop = UDim.new(0, 4)
	pad.PaddingBottom = UDim.new(0, 4)
	pad.Parent = toast

	task.delay(2.5, function()
		local fade = TweenInfo.new(0.4)
		TweenService:Create(toast, fade, { BackgroundTransparency = 1, TextTransparency = 1 }):Play()
		task.wait(0.4)
		toast:Destroy()
	end)
end

remotes:WaitForChild("Notify").OnClientEvent:Connect(showToast)

---------------------------------------------------------------------
-- Argent et multiplicateur
---------------------------------------------------------------------
local function updateMultiplier()
	local mult = player:GetAttribute("Multiplier") or 1
	multLabel.Text = "Gains x" .. tostring(mult)
end
player:GetAttributeChangedSignal("Multiplier"):Connect(updateMultiplier)
updateMultiplier()

task.spawn(function()
	local leaderstats = player:WaitForChild("leaderstats")
	local cash = leaderstats:WaitForChild("Argent")
	local last = cash.Value
	local function update()
		cashLabel.Text = formatNumber(cash.Value) .. " " .. CURRENCY
		if cash.Value > last then
			-- petit effet quand on gagne de l'argent
			cashFrame.Size = UDim2.fromOffset(256, 68)
			TweenService:Create(cashFrame, TweenInfo.new(0.2), { Size = UDim2.fromOffset(240, 64) }):Play()
		end
		last = cash.Value
	end
	cash.Changed:Connect(update)
	update()
end)

---------------------------------------------------------------------
-- Fenêtre de confirmation de renaissance
---------------------------------------------------------------------
local dialog = Instance.new("Frame")
dialog.AnchorPoint = Vector2.new(0.5, 0.5)
dialog.Position = UDim2.fromScale(0.5, 0.5)
dialog.Size = UDim2.fromOffset(340, 200)
dialog.BackgroundColor3 = Color3.fromRGB(40, 25, 60)
dialog.Visible = false
dialog.Parent = gui
corner(dialog, 18)
local dialogStroke = Instance.new("UIStroke")
dialogStroke.Color = Color3.fromRGB(170, 85, 255)
dialogStroke.Thickness = 3
dialogStroke.Parent = dialog

label(dialog, {
	Size = UDim2.new(1, -20, 0, 40),
	Position = UDim2.fromOffset(10, 10),
	Text = "Renaissance ?",
})
local dialogText = label(dialog, {
	Size = UDim2.new(1, -30, 0, 70),
	Position = UDim2.fromOffset(15, 55),
	Text = "",
	TextColor3 = Color3.fromRGB(230, 220, 255),
	TextWrapped = true,
})

local function makeButton(text, color, xScale)
	local b = Instance.new("TextButton")
	b.AnchorPoint = Vector2.new(0.5, 1)
	b.Position = UDim2.new(xScale, 0, 1, -14)
	b.Size = UDim2.fromOffset(130, 44)
	b.BackgroundColor3 = color
	b.Font = Enum.Font.FredokaOne
	b.TextColor3 = Color3.new(1, 1, 1)
	b.TextScaled = true
	b.Text = text
	b.Parent = dialog
	corner(b, 12)
	return b
end

local yes = makeButton("Oui", Color3.fromRGB(0, 180, 90), 0.27)
local no = makeButton("Non", Color3.fromRGB(200, 50, 60), 0.73)

remotes:WaitForChild("AskRebirth").OnClientEvent:Connect(function(price, newMultiplier)
	dialogText.Text = string.format(
		"Coût : %s %s. Tu repars de zéro (argent et machines),\nmais tes gains passent à x%s pour toujours !",
		formatNumber(price),
		CURRENCY,
		tostring(newMultiplier)
	)
	dialog.Visible = true
end)

yes.Activated:Connect(function()
	dialog.Visible = false
	remotes.ConfirmRebirth:FireServer()
end)

no.Activated:Connect(function()
	dialog.Visible = false
end)
