import gym
from gym import spaces
import numpy as np


class SimpleFactoryEnv(gym.Env):
    """A simple factory simulation with two machines."""
    def __init__(self):
        super(SimpleFactoryEnv, self).__init__()
        # State: [machine_1_status, machine_2_status, energy_left]
        self.observation_space = spaces.Box(low=0, high=1, shape=(3,), dtype=np.float32)
        # Actions: 0 = idle, 1 = run machine 1, 2 = run machine 2
        self.action_space = spaces.Discrete(3)
        self.max_energy = 10
        self.reset()
    
    def reset(self):
        self.machine_1_status = 1  # working
        self.machine_2_status = 1  # working
        self.energy_left = self.max_energy
        self.steps = 0
        return np.array([self.machine_1_status, self.machine_2_status, self.energy_left / self.max_energy], dtype=np.float32)
    
    def step(self, action):
        reward = 0
        done = False

        # Both machines start working; each run may break them
        if action == 1 and self.machine_1_status:
            reward += 2  # Machine 1 produces
            self.energy_left -= 2
            # Small chance of breaking
            if np.random.rand() < 0.1:
                self.machine_1_status = 0
        elif action == 2 and self.machine_2_status:
            reward += 3  # Machine 2 is more productive
            self.energy_left -= 3
            if np.random.rand() < 0.2:
                self.machine_2_status = 0
        else:
            reward -= 0.5  # Penalty for idling or selecting a broken machine
        
        # Small penalty for energy usage
        reward -= 0.1 * (self.max_energy - self.energy_left)
        
        self.steps += 1

        # End episode if energy is out, both machines are broken, or after 20 steps
        if self.energy_left <= 0 or (self.machine_1_status == 0 and self.machine_2_status == 0) or self.steps >= 20:
            done = True
        
        obs = np.array([self.machine_1_status, self.machine_2_status, self.energy_left / self.max_energy], dtype=np.float32)
        return obs, reward, done, {}
    
    def render(self, mode='human'):
        print(f"Step: {self.steps} | Machine 1: {self.machine_1_status} | Machine 2: {self.machine_2_status} | Energy: {self.energy_left}")
