import re

# Map of old imports to new imports
NEW_IMPORTS = {
    "Modal": "DialogRoot",
    "ModalOverlay": "DialogBackdrop",
    "ModalContent": "DialogContent",
    "ModalHeader": "DialogHeader",
    "ModalBody": "DialogBody",
    "ModalFooter": "DialogFooter",
    "ModalCloseButton": "DialogCloseTrigger",
}

# Find all modal files (except ViewCodeModal which is already done)
modal_files = [
    "src/components/AddPlayerModal.tsx",
    "src/components/DeactivateModal.tsx",
    "src/components/DeleteAllPlayersModal.tsx",
    "src/components/EditPlayerModal.tsx",
    "src/components/ExportDatabaseModal.tsx",
    "src/components/ImportDatabaseModal.tsx",
    "src/components/ResetAllCodesModal.tsx",
    "src/components/ResetCodeModal.tsx",
]

for file_path in modal_files:
    try:
        with open(file_path, "r") as f:
            content = f.read()

        # Update imports
        for old, new in NEW_IMPORTS.items():
            content = re.sub(rf'\b{old}\b', new, content)

        # Update Modal props: isOpen -> open, onClose -> onOpenChange
        content = re.sub(
            r'<DialogRoot\s+isOpen=\{(\w+)\}\s+onClose=\{(\w+)\}',
            r'<DialogRoot open={\1} onOpenChange={({ open }) => !open && \2()}',
            content
        )

        # Update InputGroup -> Input.Group
        content = re.sub(r'<InputGroup\b', '<Input.Group', content)
        content = re.sub(r'</InputGroup>', '</Input.Group>', content)

        # Update InputRightElement -> Input.RightElement
        content = re.sub(r'<InputRightElement\b', '<Input.RightElement', content)
        content = re.sub(r'</InputRightElement>', '</Input.RightElement>', content)

        # Update InputLeftElement -> Input.LeftElement
        content = re.sub(r'<InputLeftElement\b', '<Input.LeftElement', content)
        content = re.sub(r'</InputLeftElement>', '</Input.LeftElement>', content)

        with open(file_path, "w") as f:
            f.write(content)

        print(f"Updated: {file_path}")
    except Exception as e:
        print(f"Error updating {file_path}: {e}")

print("Done!")
