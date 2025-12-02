"use client";

import React, { useState } from 'react';
import { IOSButton } from './ios-button';
import { IOSBadge } from './ios-badge';
import { 
  IOSCard, 
  IOSCardHeader, 
  IOSCardTitle, 
  IOSCardDescription,
  IOSCardContent, 
  IOSCardFooter
} from './ios-card';
import { IOSInput } from './ios-input';
import { IOSModal, IOSModalHeader, IOSModalTitle, IOSModalContent, IOSModalFooter } from './ios-modal';
import { IOSThemeSwitch } from './ios-theme-provider';
import { 
  HomeIcon, 
  BellIcon, 
  GearIcon, 
  PlusIcon, 
  CheckIcon,
  SearchIcon,
  TrashIcon,
  InfoIcon,
  AlertIcon,
  UserIcon,
  ChevronRightIcon
} from './ios-icons';

export function IOSDesignDemo() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');
  
  return (
    <div className="p-6 max-w-4xl mx-auto space-y-12">
      <div className="text-center mb-8 ios-fade-in">
        <h1 className="ios-headline mb-2">iOS Design System</h1>
        <p className="ios-body text-ios-text-secondary">
          A comprehensive design system inspired by iOS for FG Grill application
        </p>
        <div className="mt-4 flex justify-center">
          <IOSThemeSwitch />
        </div>
      </div>
      
      {/* Typography */}
      <section id="typography" className="ios-slide-up">
        <IOSCard>
          <IOSCardHeader>
            <IOSCardTitle>Typography</IOSCardTitle>
            <IOSCardDescription>iOS-style typography using SF Pro fonts</IOSCardDescription>
          </IOSCardHeader>
          <IOSCardContent>
            <div className="space-y-4">
              <div>
                <h1 className="ios-headline">Headline</h1>
                <p className="text-xs text-ios-text-secondary">ios-headline (34px)</p>
              </div>
              <div>
                <h2 className="ios-title-1">Title 1</h2>
                <p className="text-xs text-ios-text-secondary">ios-title-1 (28px)</p>
              </div>
              <div>
                <h3 className="ios-title-2">Title 2</h3>
                <p className="text-xs text-ios-text-secondary">ios-title-2 (22px)</p>
              </div>
              <div>
                <h4 className="ios-title-3">Title 3</h4>
                <p className="text-xs text-ios-text-secondary">ios-title-3 (20px)</p>
              </div>
              <div>
                <p className="ios-body">Body text is used for most content in the application.</p>
                <p className="text-xs text-ios-text-secondary">ios-body (17px)</p>
              </div>
              <div>
                <p className="ios-body-emphasized">Body emphasized text for important information.</p>
                <p className="text-xs text-ios-text-secondary">ios-body-emphasized (17px bold)</p>
              </div>
              <div>
                <p className="ios-caption-1">Caption 1 text for secondary information.</p>
                <p className="text-xs text-ios-text-secondary">ios-caption-1 (14px)</p>
              </div>
              <div>
                <p className="ios-caption-2">Caption 2 text for smaller secondary information.</p>
                <p className="text-xs text-ios-text-secondary">ios-caption-2 (12px)</p>
              </div>
            </div>
          </IOSCardContent>
        </IOSCard>
      </section>
      
      {/* Colors */}
      <section id="colors" className="ios-slide-up">
        <IOSCard>
          <IOSCardHeader>
            <IOSCardTitle>Colors</IOSCardTitle>
            <IOSCardDescription>iOS-style color system with automatic dark mode support</IOSCardDescription>
          </IOSCardHeader>
          <IOSCardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 rounded-ios-lg bg-ios-blue-light dark:bg-ios-blue-dark text-white text-center">
                <p>Blue</p>
              </div>
              <div className="p-4 rounded-ios-lg bg-ios-green-light dark:bg-ios-green-dark text-white text-center">
                <p>Green</p>
              </div>
              <div className="p-4 rounded-ios-lg bg-ios-indigo-light dark:bg-ios-indigo-dark text-white text-center">
                <p>Indigo</p>
              </div>
              <div className="p-4 rounded-ios-lg bg-ios-orange-light dark:bg-ios-orange-dark text-white text-center">
                <p>Orange</p>
              </div>
              <div className="p-4 rounded-ios-lg bg-ios-pink-light dark:bg-ios-pink-dark text-white text-center">
                <p>Pink</p>
              </div>
              <div className="p-4 rounded-ios-lg bg-ios-purple-light dark:bg-ios-purple-dark text-white text-center">
                <p>Purple</p>
              </div>
              <div className="p-4 rounded-ios-lg bg-ios-red-light dark:bg-ios-red-dark text-white text-center">
                <p>Red</p>
              </div>
              <div className="p-4 rounded-ios-lg bg-ios-teal-light dark:bg-ios-teal-dark text-white text-center">
                <p>Teal</p>
              </div>
            </div>
            
            <div className="mt-6 grid grid-cols-2 md:grid-cols-6 gap-3">
              <div className="p-4 rounded-ios-lg bg-ios-gray-1 text-white text-center">
                <p className="text-xs">Gray 1</p>
              </div>
              <div className="p-4 rounded-ios-lg bg-ios-gray-2 text-white text-center">
                <p className="text-xs">Gray 2</p>
              </div>
              <div className="p-4 rounded-ios-lg bg-ios-gray-3 text-white text-center">
                <p className="text-xs">Gray 3</p>
              </div>
              <div className="p-4 rounded-ios-lg bg-ios-gray-4 text-black text-center">
                <p className="text-xs">Gray 4</p>
              </div>
              <div className="p-4 rounded-ios-lg bg-ios-gray-5 text-black text-center">
                <p className="text-xs">Gray 5</p>
              </div>
              <div className="p-4 rounded-ios-lg bg-ios-gray-6 text-black text-center">
                <p className="text-xs">Gray 6</p>
              </div>
            </div>
          </IOSCardContent>
        </IOSCard>
      </section>
      
      {/* Icons */}
      <section id="icons" className="ios-slide-up">
        <IOSCard>
          <IOSCardHeader>
            <IOSCardTitle>Icons</IOSCardTitle>
            <IOSCardDescription>iOS-style SF Symbol inspired icons</IOSCardDescription>
          </IOSCardHeader>
          <IOSCardContent>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-5">
              <div className="flex flex-col items-center gap-2">
                <HomeIcon size="lg" color="primary" />
                <p className="text-sm">HomeIcon</p>
              </div>
              <div className="flex flex-col items-center gap-2">
                <BellIcon size="lg" color="warning" />
                <p className="text-sm">BellIcon</p>
              </div>
              <div className="flex flex-col items-center gap-2">
                <GearIcon size="lg" color="muted" />
                <p className="text-sm">GearIcon</p>
              </div>
              <div className="flex flex-col items-center gap-2">
                <PlusIcon size="lg" color="success" />
                <p className="text-sm">PlusIcon</p>
              </div>
              <div className="flex flex-col items-center gap-2">
                <CheckIcon size="lg" color="success" />
                <p className="text-sm">CheckIcon</p>
              </div>
              <div className="flex flex-col items-center gap-2">
                <SearchIcon size="lg" />
                <p className="text-sm">SearchIcon</p>
              </div>
              <div className="flex flex-col items-center gap-2">
                <TrashIcon size="lg" color="danger" />
                <p className="text-sm">TrashIcon</p>
              </div>
              <div className="flex flex-col items-center gap-2">
                <InfoIcon size="lg" color="info" />
                <p className="text-sm">InfoIcon</p>
              </div>
              <div className="flex flex-col items-center gap-2">
                <AlertIcon size="lg" color="danger" />
                <p className="text-sm">AlertIcon</p>
              </div>
              <div className="flex flex-col items-center gap-2">
                <UserIcon size="lg" color="primary" />
                <p className="text-sm">UserIcon</p>
              </div>
            </div>
            
            <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-ios-secondary-background rounded-ios-lg">
                <h4 className="ios-title-3 mb-4">Icon Backgrounds</h4>
                <div className="flex flex-wrap gap-4">
                  <HomeIcon size="md" color="primary" background="subtle" />
                  <BellIcon size="md" color="warning" background="subtle" />
                  <GearIcon size="md" color="default" background="subtle" />
                  <PlusIcon size="md" color="success" background="solid" />
                  <TrashIcon size="md" color="danger" background="solid" />
                </div>
              </div>
              
              <div className="p-4 bg-ios-secondary-background rounded-ios-lg">
                <h4 className="ios-title-3 mb-4">Icon Sizes</h4>
                <div className="flex items-end gap-4">
                  <HomeIcon size="xs" color="primary" />
                  <HomeIcon size="sm" color="primary" />
                  <HomeIcon size="md" color="primary" />
                  <HomeIcon size="lg" color="primary" />
                  <HomeIcon size="xl" color="primary" />
                </div>
              </div>
            </div>
          </IOSCardContent>
        </IOSCard>
      </section>
      
      {/* Buttons */}
      <section id="buttons" className="ios-slide-up">
        <IOSCard>
          <IOSCardHeader>
            <IOSCardTitle>Buttons</IOSCardTitle>
            <IOSCardDescription>iOS-style buttons with various styles and sizes</IOSCardDescription>
          </IOSCardHeader>
          <IOSCardContent>
            <div className="space-y-6">
              <div>
                <h4 className="ios-title-3 mb-4">Button Variants</h4>
                <div className="flex flex-wrap gap-3">
                  <IOSButton>Primary</IOSButton>
                  <IOSButton variant="secondary">Secondary</IOSButton>
                  <IOSButton variant="destructive">Destructive</IOSButton>
                  <IOSButton variant="success">Success</IOSButton>
                  <IOSButton variant="outline">Outline</IOSButton>
                  <IOSButton variant="ghost">Ghost</IOSButton>
                  <IOSButton variant="link">Link Button</IOSButton>
                </div>
              </div>
              
              <div>
                <h4 className="ios-title-3 mb-4">Button Sizes</h4>
                <div className="flex flex-wrap gap-3 items-center">
                  <IOSButton size="xs">Extra Small</IOSButton>
                  <IOSButton size="sm">Small</IOSButton>
                  <IOSButton size="md">Medium</IOSButton>
                  <IOSButton size="lg">Large</IOSButton>
                  <IOSButton size="xl">Extra Large</IOSButton>
                </div>
              </div>
              
              <div>
                <h4 className="ios-title-3 mb-4">Button States</h4>
                <div className="flex flex-wrap gap-3">
                  <IOSButton disabled>Disabled</IOSButton>
                  <IOSButton loading>Loading</IOSButton>
                  <IOSButton leftIcon={<PlusIcon />}>With Left Icon</IOSButton>
                  <IOSButton rightIcon={<ChevronRightIcon />}>With Right Icon</IOSButton>
                </div>
              </div>
              
              <div>
                <h4 className="ios-title-3 mb-4">Special Buttons</h4>
                <div className="flex flex-wrap gap-3">
                  <IOSButton pill>Pill Button</IOSButton>
                  <IOSButton size="icon"><PlusIcon /></IOSButton>
                  <IOSButton fullWidth className="mt-2">Full Width Button</IOSButton>
                  <IOSButton glass variant="outline" className="mt-2">Glass Effect</IOSButton>
                </div>
              </div>
            </div>
          </IOSCardContent>
        </IOSCard>
      </section>
      
      {/* Cards */}
      <section id="cards" className="ios-slide-up">
        <IOSCard>
          <IOSCardHeader>
            <IOSCardTitle>Cards</IOSCardTitle>
            <IOSCardDescription>iOS-style card components with various styles</IOSCardDescription>
          </IOSCardHeader>
          <IOSCardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <IOSCard variant="default">
                <IOSCardHeader>
                  <IOSCardTitle>Default Card</IOSCardTitle>
                  <IOSCardDescription>Basic card with border and shadow</IOSCardDescription>
                </IOSCardHeader>
                <IOSCardContent>
                  <p>This is the content of a default card.</p>
                </IOSCardContent>
                <IOSCardFooter>
                  <IOSButton size="sm">Action</IOSButton>
                </IOSCardFooter>
              </IOSCard>
              
              <IOSCard variant="elevated">
                <IOSCardHeader>
                  <IOSCardTitle>Elevated Card</IOSCardTitle>
                  <IOSCardDescription>Card with more prominent shadow</IOSCardDescription>
                </IOSCardHeader>
                <IOSCardContent>
                  <p>This is the content of an elevated card.</p>
                </IOSCardContent>
                <IOSCardFooter>
                  <IOSButton size="sm">Action</IOSButton>
                </IOSCardFooter>
              </IOSCard>
              
              <IOSCard variant="filled" padding="lg">
                <IOSCardHeader>
                  <IOSCardTitle>Filled Card</IOSCardTitle>
                  <IOSCardDescription>Card with background fill</IOSCardDescription>
                </IOSCardHeader>
                <IOSCardContent>
                  <p>This is the content of a filled card with lg padding.</p>
                </IOSCardContent>
                <IOSCardFooter bordered>
                  <IOSButton size="sm">Action</IOSButton>
                </IOSCardFooter>
              </IOSCard>
              
              <IOSCard variant="glass" clickable hover>
                <IOSCardHeader>
                  <IOSCardTitle>Interactive Card</IOSCardTitle>
                  <IOSCardDescription>Card with hover and click effects</IOSCardDescription>
                </IOSCardHeader>
                <IOSCardContent>
                  <p>This card has hover and click effects.</p>
                </IOSCardContent>
                <IOSCardFooter>
                  <IOSButton size="sm" variant="ghost">View More</IOSButton>
                </IOSCardFooter>
              </IOSCard>
            </div>
          </IOSCardContent>
        </IOSCard>
      </section>
      
      {/* Badges */}
      <section id="badges" className="ios-slide-up">
        <IOSCard>
          <IOSCardHeader>
            <IOSCardTitle>Badges</IOSCardTitle>
            <IOSCardDescription>iOS-style badge components</IOSCardDescription>
          </IOSCardHeader>
          <IOSCardContent>
            <div className="space-y-6">
              <div>
                <h4 className="ios-title-3 mb-4">Badge Variants</h4>
                <div className="flex flex-wrap gap-3">
                  <IOSBadge>Default</IOSBadge>
                  <IOSBadge color="secondary">Secondary</IOSBadge>
                  <IOSBadge color="success">Success</IOSBadge>
                  <IOSBadge color="warning">Warning</IOSBadge>
                  <IOSBadge color="danger">Danger</IOSBadge>
                  <IOSBadge color="info">Info</IOSBadge>
                  <IOSBadge color="purple">Purple</IOSBadge>
                </div>
              </div>
              
              <div>
                <h4 className="ios-title-3 mb-4">Light Badges</h4>
                <div className="flex flex-wrap gap-3">
                  <IOSBadge variant="light">Default</IOSBadge>
                  <IOSBadge variant="light" color="secondary">Secondary</IOSBadge>
                  <IOSBadge variant="light" color="success">Success</IOSBadge>
                  <IOSBadge variant="light" color="warning">Warning</IOSBadge>
                  <IOSBadge variant="light" color="danger">Danger</IOSBadge>
                  <IOSBadge variant="light" color="info">Info</IOSBadge>
                </div>
              </div>
              
              <div>
                <h4 className="ios-title-3 mb-4">Outline Badges</h4>
                <div className="flex flex-wrap gap-3">
                  <IOSBadge variant="outline">Default</IOSBadge>
                  <IOSBadge variant="outline" color="secondary">Secondary</IOSBadge>
                  <IOSBadge variant="outline" color="success">Success</IOSBadge>
                  <IOSBadge variant="outline" color="warning">Warning</IOSBadge>
                  <IOSBadge variant="outline" color="danger">Danger</IOSBadge>
                </div>
              </div>
              
              <div>
                <h4 className="ios-title-3 mb-4">Badge Sizes</h4>
                <div className="flex flex-wrap gap-3 items-center">
                  <IOSBadge size="xs">Extra Small</IOSBadge>
                  <IOSBadge size="sm">Small</IOSBadge>
                  <IOSBadge size="md">Medium</IOSBadge>
                  <IOSBadge size="lg">Large</IOSBadge>
                </div>
              </div>
              
              <div>
                <h4 className="ios-title-3 mb-4">Special Badges</h4>
                <div className="flex flex-wrap gap-3 items-center">
                  <IOSBadge dot />
                  <IOSBadge count={5} />
                  <IOSBadge count={99} max={99} />
                  <IOSBadge count={150} max={99} />
                  <IOSBadge startIcon={<CheckIcon />}>Done</IOSBadge>
                </div>
              </div>
            </div>
          </IOSCardContent>
        </IOSCard>
      </section>
      
      {/* Inputs */}
      <section id="inputs" className="ios-slide-up">
        <IOSCard>
          <IOSCardHeader>
            <IOSCardTitle>Inputs</IOSCardTitle>
            <IOSCardDescription>iOS-style input components</IOSCardDescription>
          </IOSCardHeader>
          <IOSCardContent>
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <IOSInput 
                  label="Default Input"
                  placeholder="Enter text here"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                />
                
                <IOSInput 
                  label="Input with Icon"
                  placeholder="Search..."
                  icon={<SearchIcon />}
                />
                
                <IOSInput 
                  label="Error State"
                  placeholder="Enter email"
                  error="Please enter a valid email"
                />
                
                <IOSInput 
                  label="Success State"
                  placeholder="Enter username"
                  variant="success"
                  caption="Username is available"
                />
                
                <IOSInput 
                  label="With Caption"
                  placeholder="Enter password"
                  type="password"
                  caption="Password must be at least 8 characters"
                />
                
                <IOSInput 
                  placeholder="Floating Label"
                  label="Floating Label"
                  floatingLabel
                />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <IOSInput 
                  label="Small Input"
                  placeholder="Small"
                  size="sm"
                />
                
                <IOSInput 
                  label="Medium Input"
                  placeholder="Medium"
                  size="md"
                />
                
                <IOSInput 
                  label="Large Input"
                  placeholder="Large"
                  size="lg"
                />
              </div>
              
              <div>
                <IOSInput 
                  label="Filled Style"
                  placeholder="Enter text here"
                  filled
                />
              </div>
              
              <div>
                <IOSInput 
                  label="Rounded Input"
                  placeholder="Enter text here"
                  rounded="full"
                />
              </div>
            </div>
          </IOSCardContent>
        </IOSCard>
      </section>
      
      {/* Modal */}
      <section id="modals" className="ios-slide-up">
        <IOSCard>
          <IOSCardHeader>
            <IOSCardTitle>Modals</IOSCardTitle>
            <IOSCardDescription>iOS-style modal components</IOSCardDescription>
          </IOSCardHeader>
          <IOSCardContent>
            <div className="flex flex-wrap gap-3">
              <IOSButton onClick={() => setIsModalOpen(true)}>
                Open Modal
              </IOSButton>
            </div>
          </IOSCardContent>
        </IOSCard>
        
        <IOSModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          variant="default"
        >
          <IOSModalHeader>
            <IOSModalTitle>iOS-Style Modal</IOSModalTitle>
          </IOSModalHeader>
          <IOSModalContent>
            <p className="mb-4">
              This is an iOS-style modal with a clean design. It features a backdrop blur effect
              and smooth animations.
            </p>
            <IOSInput 
              label="Sample Input"
              placeholder="Enter some text"
            />
          </IOSModalContent>
          <IOSModalFooter>
            <IOSButton variant="secondary" onClick={() => setIsModalOpen(false)}>
              Cancel
            </IOSButton>
            <IOSButton onClick={() => setIsModalOpen(false)}>
              Confirm
            </IOSButton>
          </IOSModalFooter>
        </IOSModal>
      </section>
    </div>
  );
}

export default IOSDesignDemo;
