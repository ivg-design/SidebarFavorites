
local SLOTS = 8
local NSHAPES = 9
local OMEGA = 10.0      -- spring stiffness: settles in roughly 450 ms
local IDLE = 2.5        -- seconds before auto advances

type Morph = {
    paint: Paint,
    path: Path,
    size: Vector,
    target: Property<number>?,
    auto: Property<boolean>?,
    cur: { { number } },   -- points on screen now, [slot] = flat x,y list
    from: { { number } },  -- snapshot taken at the last retarget
    goal: number,          -- shape index (0-based) being morphed toward
    t: number,             -- spring position 0..1
    v: number,             -- spring velocity
    idle: number,
    seen: number,          -- last target value read from the view model
    ready: boolean,
}

-- decode every contour once into numeric lists
local SHAPES: { { { number } } } = {}
for si = 1, NSHAPES do
    local contours: { { number } } = {}
    for s = 1, SLOTS do
        local list: { number } = {}
        for token in string.gmatch(DATA[si][s], "[^,]+") do
            table.insert(list, tonumber(token) or 0)
        end
        contours[s] = list
    end
    SHAPES[si] = contours
end

local function copyShape(index: number): { { number } }
    local out: { { number } } = {}
    for s = 1, SLOTS do
        local src = SHAPES[index + 1][s]
        local dst: { number } = table.create(#src, 0)
        for i = 1, #src do dst[i] = src[i] end
        out[s] = dst
    end
    return out
end

local function retarget(self: Morph, index: number)
    local idx = math.clamp(math.floor(index + 0.5), 0, NSHAPES - 1)
    if idx == self.goal and self.t >= 1 then return end
    for s = 1, SLOTS do
        local c, f = self.cur[s], self.from[s]
        for i = 1, #c do f[i] = c[i] end
    end
    self.goal = idx
    self.t = 0
    self.v = 0
end

function init(self: Morph, context: Context): boolean
    local vm = context:viewModel()
    if vm == nil then return true end
    self.target = vm:getNumber('target')
    self.auto = vm:getBoolean('auto')
    if self.target ~= nil then
        self.seen = self.target.value
        retarget(self, self.seen)
        -- first bind: start fully formed on the requested shape
        self.goal = math.clamp(math.floor(self.seen + 0.5), 0, NSHAPES - 1)
        self.cur = copyShape(self.goal)
        self.from = copyShape(self.goal)
        self.t = 1
    end
    return true
end

function resize(self: Morph, size: Vector)
    self.size = size
end

function advance(self: Morph, dt: number): boolean
    dt = math.min(dt, 1 / 20)
    local tp = self.target
    if tp ~= nil then
        local value = tp.value
        if value ~= self.seen then
            self.seen = value
            self.idle = 0
            retarget(self, value)
        else
            self.idle += dt
            local auto = self.auto
            if auto ~= nil and auto.value and self.idle >= IDLE and self.t >= 1 then
                self.idle = 0
                local nextIndex = (self.goal + 1) % NSHAPES
                self.seen = nextIndex
                tp.value = nextIndex
                retarget(self, nextIndex)
            end
        end
    end

    if self.t < 1 or self.v ~= 0 then
        -- critically damped spring toward 1
        local x = self.t - 1
        local accel = -OMEGA * OMEGA * x - 2 * OMEGA * self.v
        self.v += accel * dt
        self.t += self.v * dt
        if math.abs(1 - self.t) < 0.0005 and math.abs(self.v) < 0.01 then
            self.t = 1
            self.v = 0
        end
        local goal = SHAPES[self.goal + 1]
        local t = self.t
        for s = 1, SLOTS do
            local c, f, g = self.cur[s], self.from[s], goal[s]
            for i = 1, #c do
                c[i] = f[i] + (g[i] - f[i]) * t
            end
        end
    end
    return true
end

function draw(self: Morph, renderer: Renderer)
    local scale = math.min(self.size.x, self.size.y) / 240
    local cx, cy = self.size.x / 2, self.size.y / 2
    local path = self.path
    path:reset()
    for s = 1, SLOTS do
        local c = self.cur[s]
        path:moveTo(Vector.xy(cx + c[1] * scale, cy + c[2] * scale))
        for i = 3, #c, 2 do
            path:lineTo(Vector.xy(cx + c[i] * scale, cy + c[i + 1] * scale))
        end
        path:close()
    end
    renderer:drawPath(path, self.paint)
end

return function(context: Context): Layout<Morph>
    return {
        paint = Paint.with({ color = Color.rgb(244, 244, 246) }),
        path = Path.new(),
        size = Vector.xy(240, 240),
        target = nil,
        auto = nil,
        cur = copyShape(0),
        from = copyShape(0),
        goal = 0,
        t = 1,
        v = 0,
        idle = 0,
        seen = 0,
        ready = false,
        init = init,
        resize = resize,
        advance = advance,
        draw = draw,
    }
end
